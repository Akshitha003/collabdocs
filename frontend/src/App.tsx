import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { ArrowLeft, Bold, Check, ChevronDown, Cloud, FilePlus2, FileText, Heading1, Heading2, Italic, List, ListOrdered, LoaderCircle, MoreHorizontal, Plus, Search, Share2, Trash2, Underline as UnderlineIcon, UploadCloud, Users, X } from 'lucide-react';
import { api, type Document, type User } from './api';

type Filter = 'all' | 'owned' | 'shared';
const initialContent = {type:'doc', content:[{type:'paragraph'}]};
function prettyDate(value: string) { return new Date(value).toLocaleDateString(undefined, {month:'short',day:'numeric',year:'numeric'}); }

function Editor({doc, onChange}: {doc:Document;onChange:(value:Record<string,unknown>)=>void}) {
  const latest = useRef(onChange); latest.current = onChange;
  const editor = useEditor({ extensions:[StarterKit, Underline], content:doc.content || initialContent,
    editorProps:{attributes:{class:'prose-editor', 'aria-label':'Document content'}},
    onUpdate:({editor})=>latest.current(editor.getJSON()) });
  useEffect(()=>{ if (editor) editor.commands.setContent(doc.content || initialContent, false); },[doc.id,editor]);
  if (!editor) return <div className="editor-page">Loading editor…</div>;
  const controls = [
    {title:'Bold', icon:<Bold size={17}/>, action:()=>editor.chain().focus().toggleBold().run(), active:editor.isActive('bold')},
    {title:'Italic', icon:<Italic size={17}/>, action:()=>editor.chain().focus().toggleItalic().run(), active:editor.isActive('italic')},
    {title:'Underline', icon:<UnderlineIcon size={17}/>, action:()=>editor.chain().focus().toggleUnderline().run(), active:editor.isActive('underline')},
    {title:'Heading 1', icon:<Heading1 size={18}/>, action:()=>editor.chain().focus().toggleHeading({level:1}).run(), active:editor.isActive('heading',{level:1})},
    {title:'Heading 2', icon:<Heading2 size={18}/>, action:()=>editor.chain().focus().toggleHeading({level:2}).run(), active:editor.isActive('heading',{level:2})},
    {title:'Bulleted list', icon:<List size={18}/>, action:()=>editor.chain().focus().toggleBulletList().run(), active:editor.isActive('bulletList')},
    {title:'Numbered list', icon:<ListOrdered size={18}/>, action:()=>editor.chain().focus().toggleOrderedList().run(), active:editor.isActive('orderedList')}
  ];
  return <><div className="toolbar"><span className="toolbar-label">Formatting</span><span className="tool-divider"/>{controls.map(c=><button key={c.title} title={c.title} aria-label={c.title} aria-pressed={c.active} className={`tool-button ${c.active?'active':''}`} onClick={c.action}>{c.icon}</button>)}</div><div className="editor-scroll"><div className="editor-page"><EditorContent editor={editor}/></div><p className="editor-hint">Changes are saved automatically as you type.</p></div></>;
}

export default function App() {
  const [users,setUsers] = useState<User[]>([]);
  const [userId,setUserId] = useState<number>(()=>Number(localStorage.getItem('collabdocs-user')) || 0);
  const [docs,setDocs] = useState<Document[]>([]);
  const [selected,setSelected] = useState<Document|null>(null);
  const [filter,setFilter] = useState<Filter>('all');
  const [search,setSearch] = useState('');
  const [loading,setLoading] = useState(true);
  const [busy,setBusy] = useState(false);
  const [saveState,setSaveState] = useState<'saved'|'saving'|'error'>('saved');
  const [error,setError] = useState('');
  const [shareOpen,setShareOpen] = useState(false);
  const [shareEmail,setShareEmail] = useState('');
  const [shareBusy,setShareBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>|null>(null);
  const generation = useRef(0);
  const pending = useRef<Promise<unknown>>(Promise.resolve());
  const draft = useRef<Record<string,unknown>>({});
  const selectedRef = useRef<Document|null>(null);
  selectedRef.current = selected;
  const showError=(e:unknown)=>setError(e instanceof Error?e.message:String(e));
  const refresh=useCallback(async(id:number)=>setDocs(await api<Document[]>('/documents',id)),[]);
  useEffect(()=>{api<User[]>('/users').then(list=>{setUsers(list);if(!list.some(u=>u.id===userId))setUserId(list[0]?.id||0);}).catch(showError);},[]);
  useEffect(()=>{if(!userId)return;localStorage.setItem('collabdocs-user',String(userId));setSelected(null);setLoading(true);refresh(userId).catch(showError).finally(()=>setLoading(false));},[userId,refresh]);
  useEffect(()=>()=>{if(timer.current)clearTimeout(timer.current);},[]);
  const save = (id:number,uid:number,body:Record<string,unknown>,gen:number)=>{
    setSaveState('saving');
    pending.current=pending.current.catch(()=>{}).then(()=>api<Document>(`/documents/${id}`,uid,{method:'PATCH',body:JSON.stringify(body)})).then(updated=>{
      if(generation.current===gen){setSaveState('saved');setDocs(old=>old.map(d=>d.id===id?updated:d));}
    }).catch(e=>{if(generation.current===gen){setSaveState('error');showError(e);}});
  };
  const queueSave=(body:Record<string,unknown>)=>{
    const doc=selectedRef.current;if(!doc)return;
    const gen=generation.current;
    draft.current={...draft.current,...body};
    setSaveState('saving');
    if(timer.current)clearTimeout(timer.current);
    timer.current=setTimeout(()=>{timer.current=null;const changes=draft.current;draft.current={};save(doc.id,userId,changes,gen);},650);
  };
  
const flush = async () => {
  if (timer.current) {
    clearTimeout(timer.current);
    timer.current = null;

    const d = selectedRef.current;

    if (d) {
      const changes = draft.current;
      draft.current = {};
      save(d.id, userId, changes, generation.current);
    }
  }

  await pending.current;
};
  const open=async(id:number)=>{await flush();generation.current++;setSaveState('saved');try{setSelected(await api<Document>(`/documents/${id}`,userId));}catch(e){showError(e);}};
  const close=async()=>{await flush();generation.current++;setSelected(null);await refresh(userId).catch(showError);};
  const create=async()=>{setBusy(true);try{await flush();const doc=await api<Document>('/documents',userId,{method:'POST',body:JSON.stringify({title:'Untitled document'})});await refresh(userId);generation.current++;setSelected(doc);}catch(e){showError(e);}finally{setBusy(false);}};
  const importFile=async(file?:File)=>{if(!file)return;setBusy(true);try{await flush();const form=new FormData();form.append('file',file);const doc=await api<Document>('/documents/import',userId,{method:'POST',body:form});await refresh(userId);generation.current++;setSelected(doc);}catch(e){showError(e);}finally{setBusy(false);if(fileRef.current)fileRef.current.value='';}};
  const rename=(title:string)=>{setSelected(d=>d?{...d,title}:d);queueSave({title});};
  const editContent=(content:Record<string,unknown>)=>{setSelected(d=>d?{...d,content}:d);queueSave({content});};
  const remove=async(doc:Document)=>{if(!window.confirm(`Delete “${doc.title}”? This cannot be undone.`))return;try{await flush();await api(`/documents/${doc.id}`,userId,{method:'DELETE'});generation.current++;setSelected(null);await refresh(userId);}catch(e){showError(e);}};
  const share=async()=>{if(!selected)return;setShareBusy(true);try{await flush();const updated=await api<Document>(`/documents/${selected.id}/share`,userId,{method:'POST',body:JSON.stringify({email:shareEmail.trim(),role:'editor'})});setSelected(updated);setShareEmail('');await refresh(userId);}catch(e){showError(e);}finally{setShareBusy(false);}};
  const unshare=async(recipientId:number)=>{if(!selected)return;try{await api(`/documents/${selected.id}/share/${recipientId}`,userId,{method:'DELETE'});setSelected(await api<Document>(`/documents/${selected.id}`,userId));await refresh(userId);}catch(e){showError(e);}};
  const switchUser=async(id:number)=>{await flush();generation.current++;setShareOpen(false);setUserId(id);};
  const visible=docs.filter(d=>(filter==='all'||(filter==='owned'?d.is_owner:!d.is_owner))&&d.title.toLowerCase().includes(search.toLowerCase()));
  const currentUser=users.find(u=>u.id===userId);
  return <div className="app-shell">
    <aside className="sidebar"><div className="brand"><div className="brand-icon"><FileText size={20}/></div><span>collab<span className="brand-accent">docs</span></span></div>
      <button className="primary new-button" onClick={create} disabled={busy}><Plus size={18}/> New document</button>
      <div className="sidebar-caption">WORKSPACE</div>
      <nav className="nav-items"><button className={filter==='all'?'nav-active':''} onClick={()=>{setFilter('all');void close();}}><FileText size={17}/> All documents <span>{docs.length}</span></button><button className={filter==='owned'?'nav-active':''} onClick={()=>{setFilter('owned');void close();}}><FilePlus2 size={17}/> My documents <span>{docs.filter(d=>d.is_owner).length}</span></button><button className={filter==='shared'?'nav-active':''} onClick={()=>{setFilter('shared');void close();}}><Users size={17}/> Shared with me <span>{docs.filter(d=>!d.is_owner).length}</span></button></nav>
      <div className="sidebar-bottom"><div className="demo-note"><span className="demo-dot"/> DEMO WORKSPACE<p>Switch accounts to test sharing and permissions.</p></div><label className="account-label" htmlFor="account">SIGNED IN AS</label><div className="account-select"><div className="avatar">{currentUser?.name.split(' ').map(x=>x[0]).join('')||'?'}</div><select id="account" value={userId} onChange={e=>void switchUser(Number(e.target.value))}>{users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select><ChevronDown size={14}/></div></div>
    </aside>
    <main className="main-content">{error&&<div className="error-toast" role="alert"><span>{error}</span><button aria-label="Dismiss error" onClick={()=>setError('')}><X size={17}/></button></div>}
      {selected ? <><header className="editor-header"><button className="icon-button back" onClick={()=>void close()} aria-label="Back to documents"><ArrowLeft size={20}/></button><div className="header-document"><input aria-label="Document title" maxLength={150} value={selected.title} onChange={e=>rename(e.target.value)} onBlur={()=>{if(!selected.title.trim())rename('Untitled document');}}/><div className="document-meta"><span>{selected.is_owner?'Owned by you':`Shared by ${selected.owner_name}`}</span><span className="meta-dot">·</span><span className={`save-indicator ${saveState}`}>{saveState==='saving'?<LoaderCircle size={12} className="spin"/>:saveState==='saved'?<Check size={12}/>:<X size={12}/>} {saveState==='saving'?'Saving…':saveState==='saved'?'All changes saved':'Save failed'}</span></div></div><div className="header-actions">{selected.is_owner&&<button className="outline-button" onClick={()=>setShareOpen(true)}><Share2 size={16}/> Share</button>}{selected.is_owner&&<button className="icon-button delete-button" title="Delete document" onClick={()=>void remove(selected)}><Trash2 size={18}/></button>}</div></header><Editor key={selected.id} doc={selected} onChange={editContent}/></> : <><header className="dashboard-top"><div><span className="eyebrow">YOUR WORKSPACE</span><h1>Documents</h1><p>Everything your team is working on, all in one place.</p></div><button className="outline-button import-top" onClick={()=>fileRef.current?.click()} disabled={busy}><UploadCloud size={17}/> Import file</button></header><div className="dashboard-body"><div className="section-head"><div><h2>{filter==='all'?'All documents':filter==='owned'?'My documents':'Shared with me'}</h2><span>{visible.length} {visible.length===1?'document':'documents'}</span></div><div className="search-field"><Search size={17}/><input placeholder="Search documents…" aria-label="Search documents" value={search} onChange={e=>setSearch(e.target.value)}/></div></div>{loading?<div className="empty-state">Loading your documents…</div>:visible.length?<div className="document-grid">{visible.map(doc=><button key={doc.id} className="document-card" onClick={()=>void open(doc.id)}><div className="card-top"><div className="file-icon"><FileText size={23}/></div><MoreHorizontal size={19} className="muted"/></div><h3>{doc.title}</h3><p>{doc.is_owner?'You own this document':`Shared by ${doc.owner_name}`}</p><div className="card-bottom"><span className={`pill ${doc.is_owner?'owned':'shared'}`}>{doc.is_owner?'My document':'Shared'}</span><span>{prettyDate(doc.updated_at)}</span></div></button>)}</div>:<div className="empty-state"><div className="empty-icon"><FileText size={28}/></div><h3>{search?'No matching documents':filter==='shared'?'Nothing shared with you yet':'Your workspace is ready'}</h3><p>{search?'Try another search term.':filter==='shared'?'Ask the other demo user to share a document with you.':'Create a document or import a text file to get started.'}</p>{!search&&filter!=='shared'&&<button className="primary" onClick={create}><Plus size={16}/> Create document</button>}</div>}</div></>}
    </main>
    <input ref={fileRef} type="file" accept=".txt,.md,text/plain,text/markdown" hidden onChange={e=>void importFile(e.target.files?.[0])}/>
    {shareOpen&&selected&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setShareOpen(false);}}><section className="share-modal" role="dialog" aria-modal="true" aria-labelledby="share-title"><div className="modal-head"><div><h2 id="share-title">Share document</h2><p>Invite someone to collaborate on “{selected.title}”.</p></div><button className="icon-button" aria-label="Close" onClick={()=>setShareOpen(false)}><X size={19}/></button></div><label className="field-label" htmlFor="share-email">Invite by email</label><div className="invite-row"><input id="share-email" placeholder="sam@demo.local" value={shareEmail} onChange={e=>setShareEmail(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')void share();}}/><button className="primary" disabled={!shareEmail.trim()||shareBusy} onClick={()=>void share()}>Invite</button></div><p className="field-help">Demo users: {users.filter(u=>u.id!==userId).map(u=>u.email).join(', ')}</p><div className="access-title">People with access</div><div className="access-row"><div className="avatar small">{currentUser?.name.split(' ').map(x=>x[0]).join('')}</div><div className="access-person"><strong>{currentUser?.name} (you)</strong><span>{currentUser?.email}</span></div><span className="access-role">Owner</span></div>{selected.shared_with.map(u=><div className="access-row" key={u.id}><div className="avatar small purple">{u.name.split(' ').map(x=>x[0]).join('')}</div><div className="access-person"><strong>{u.name}</strong><span>{u.email}</span></div><span className="access-role">Editor</span><button className="remove-access" title={`Remove ${u.name}`} aria-label={`Remove ${u.name}`} onClick={()=>void unshare(u.id)}><X size={15}/></button></div>)}<div className="modal-footer"><span><Cloud size={15}/> Changes sync when saved</span><button className="outline-button" onClick={()=>setShareOpen(false)}>Done</button></div></section></div>}
  </div>;
}
