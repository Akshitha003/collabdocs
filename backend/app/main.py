import json
import os
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from fastapi import FastAPI, Depends, HTTPException, Header, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import select, or_
from sqlalchemy.orm import Session
from .database import Base, engine, get_db, SessionLocal
from .models import User, Document, Share

EMPTY = {'type': 'doc', 'content': [{'type': 'paragraph'}]}

@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        for name, email in [('Alex Morgan', 'alex@demo.local'), ('Sam Rivera', 'sam@demo.local')]:
            if not db.scalar(select(User).where(User.email == email)):
                db.add(User(name=name, email=email))
        db.commit()
    yield

app = FastAPI(title='CollabDocs API', lifespan=lifespan)
origins = [s.strip() for s in os.getenv('CORS_ORIGINS', 'http://localhost:5173').split(',') if s.strip()]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=False, allow_methods=['GET','POST','PATCH','DELETE'], allow_headers=['*'])

class CreateDocument(BaseModel):
    title: str = Field(default='Untitled document', min_length=1, max_length=150)

class UpdateDocument(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=150)
    content: dict | None = None

class ShareRequest(BaseModel):
    email: str
    role: str = 'editor'

def current_user(x_user_id: int | None = Header(default=None), db: Session = Depends(get_db)) -> User:
    if x_user_id is None: raise HTTPException(401, 'Choose a demo user')
    user = db.get(User, x_user_id)
    if not user: raise HTTPException(401, 'Unknown demo user')
    return user

def get_document(document_id: int, user: User, db: Session, require_owner=False) -> Document:
    doc = db.get(Document, document_id)
    if not doc: raise HTTPException(404, 'Document not found')
    if doc.owner_id != user.id:
        if require_owner or not db.scalar(select(Share).where(Share.document_id == doc.id, Share.user_id == user.id)):
            raise HTTPException(403, 'Access denied')
    return doc

def payload(doc: Document, user: User, db: Session):
    return {'id': doc.id, 'title': doc.title, 'content': json.loads(doc.content), 'owner_id': doc.owner_id,
            'owner_name': doc.owner.name, 'is_owner': doc.owner_id == user.id,
            'updated_at': doc.updated_at.isoformat() if doc.updated_at else None,
            'shared_with': [{'id': s.user.id, 'name': s.user.name, 'email': s.user.email, 'role': s.role}
                            for s in db.scalars(select(Share).where(Share.document_id == doc.id)).all()] if doc.owner_id == user.id else []}

@app.get('/health')
def health(): return {'status': 'ok'}

@app.get('/users')
def users(db: Session = Depends(get_db)):
    return [{'id': u.id, 'name': u.name, 'email': u.email} for u in db.scalars(select(User).order_by(User.id)).all()]

@app.get('/documents')
def documents(user: User = Depends(current_user), db: Session = Depends(get_db)):
    docs = db.scalars(select(Document).where(or_(Document.owner_id == user.id, Document.id.in_(select(Share.document_id).where(Share.user_id == user.id)))).order_by(Document.updated_at.desc())).all()
    return [payload(d, user, db) for d in docs]

@app.post('/documents', status_code=201)
def create(body: CreateDocument, user: User = Depends(current_user), db: Session = Depends(get_db)):
    doc = Document(title=body.title.strip() or 'Untitled document', owner_id=user.id, content=json.dumps(EMPTY))
    db.add(doc); db.commit(); db.refresh(doc)
    return payload(doc, user, db)

@app.get('/documents/{document_id}')
def read(document_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    return payload(get_document(document_id, user, db), user, db)

@app.patch('/documents/{document_id}')
def update(document_id: int, body: UpdateDocument, user: User = Depends(current_user), db: Session = Depends(get_db)):
    doc = get_document(document_id, user, db)
    if body.title is not None:
        if not body.title.strip(): raise HTTPException(422, 'Title cannot be blank')
        doc.title = body.title.strip()
    if body.content is not None:
        if body.content.get('type') != 'doc' or not isinstance(body.content.get('content'), list):
            raise HTTPException(422, 'Invalid editor document')
        if len(json.dumps(body.content)) > 1_000_000: raise HTTPException(413, 'Document too large')
        doc.content = json.dumps(body.content)
    doc.updated_at = datetime.now(timezone.utc)
    db.commit(); db.refresh(doc)
    return payload(doc, user, db)

@app.delete('/documents/{document_id}', status_code=204)
def delete(document_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    doc = get_document(document_id, user, db, require_owner=True)
    for share in db.scalars(select(Share).where(Share.document_id == doc.id)).all(): db.delete(share)
    db.delete(doc); db.commit()

@app.post('/documents/{document_id}/share')
def share(document_id: int, body: ShareRequest, user: User = Depends(current_user), db: Session = Depends(get_db)):
    doc = get_document(document_id, user, db, require_owner=True)
    if body.role != 'editor': raise HTTPException(422, 'Only editor role is supported')
    recipient = db.scalar(select(User).where(User.email == body.email.strip().lower()))
    if not recipient: raise HTTPException(404, 'User not found. Choose a seeded user email.')
    if recipient.id == doc.owner_id: raise HTTPException(400, 'Owner already has access')
    if db.scalar(select(Share).where(Share.document_id == doc.id, Share.user_id == recipient.id)):
        raise HTTPException(409, 'Already shared with this user')
    db.add(Share(document_id=doc.id, user_id=recipient.id)); db.commit()
    return payload(doc, user, db)

@app.delete('/documents/{document_id}/share/{recipient_id}', status_code=204)
def unshare(document_id: int, recipient_id: int, user: User = Depends(current_user), db: Session = Depends(get_db)):
    get_document(document_id, user, db, require_owner=True)
    share = db.scalar(select(Share).where(Share.document_id == document_id, Share.user_id == recipient_id))
    if not share: raise HTTPException(404, 'Share not found')
    db.delete(share); db.commit()

@app.post('/documents/import', status_code=201)
async def import_document(file: UploadFile = File(...), user: User = Depends(current_user), db: Session = Depends(get_db)):
    filename = file.filename or ''
    if not filename.lower().endswith(('.txt', '.md')): raise HTTPException(415, 'Only .txt and .md files are supported')
    data = await file.read(256_001)
    if len(data) > 256_000: raise HTTPException(413, 'File must be 250 KB or smaller')
    try: text = data.decode('utf-8')
    except UnicodeDecodeError: raise HTTPException(422, 'File must be UTF-8 encoded')
    nodes = []
    for line in text.splitlines():
        if filename.lower().endswith('.md') and line.startswith('#') and line.lstrip('#').startswith(' '):
            level = min(len(line) - len(line.lstrip('#')), 3)
            nodes.append({'type': 'heading', 'attrs': {'level': level}, 'content': [{'type':'text','text':line[level:].strip()}]})
        else:
            nodes.append({'type': 'paragraph', 'content': [{'type':'text','text':line}]} if line else {'type':'paragraph'})
    doc = Document(title=filename.rsplit('.', 1)[0][:150] or 'Imported document', owner_id=user.id,
                   content=json.dumps({'type':'doc','content':nodes or [{'type':'paragraph'}]}))
    db.add(doc); db.commit(); db.refresh(doc)
    return payload(doc, user, db)
