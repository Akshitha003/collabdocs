# CollabDocs

A focused Google Docs-inspired collaborative document editor built with React, TypeScript, TipTap, FastAPI, and PostgreSQL. Designed as a small, reviewable product slice rather than a complete Docs clone.

## Features

- Create, rename, autosave, reopen, and delete documents.
- Rich-text formatting: bold, italic, underline, headings (H1/H2), bulleted and numbered lists.
- Import UTF-8 `.txt` and `.md` files (up to 250 KB) as new editable documents. Markdown import recognizes `#`, `##`, `###` headings; other Markdown syntax is imported as literal text.
- Share with seeded demo users by email, with editable access and owner-only sharing/deletion.
- Separate All documents, My documents, and Shared with me views.
- Persist TipTap JSON, owner, and sharing records in PostgreSQL; SQLite fallback for fast local development.
- Backend access-control and import tests.

## Local setup (quickest: SQLite)

Prerequisites: Node.js 20+, Python 3.11+.

**Terminal 1 — API**

```bash
cd backend
python -m venv .venv
source .venv/bin/activate    # Windows: .venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

No database configuration is required for SQLite; it writes `backend/collabdocs.db` and persists across restarts.

**Terminal 2 — web app**

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:5173. The backend API docs are at http://localhost:8000/docs.

## PostgreSQL setup (production-like)

From the project root:

```bash
docker compose up -d db
```

In the backend shell, set:

```bash
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/collabdocs
```

Then start Uvicorn as above. Database tables and demo accounts are created automatically on startup. This is appropriate for the take-home but should be replaced with managed migrations in production.

## Review sharing

Two accounts are seeded on first backend startup:

| Name | Email | How to access |
| --- | --- | --- |
| Alex Morgan | alex@demo.local | Select in lower-left account switcher |
| Sam Rivera | sam@demo.local | Select in lower-left account switcher |

1. Select Alex and create a document.
2. Type formatted content and wait for **All changes saved**.
3. Click **Share**, enter `sam@demo.local`, and click Invite.
4. Switch to Sam; open **Shared with me** and edit the document.
5. Switch to Alex and confirm the edit persisted. Remove Sam's access in the Share dialog and verify Sam no longer sees the document.

**Security caveat:** account switching is demo-only, using an `X-User-Id` header. It is not authentication; any client can impersonate a seeded account. The API does enforce owner/shared permissions *relative to the selected demo identity*. Never expose this demo mode to sensitive real-world data.

## Run tests

```bash
cd backend
python -m pytest -q
```

The tests use isolated in-memory SQLite, and cover unauthorized access, share/revoke behavior, rich-text persistence, owner-only deletion, file extension validation, and Markdown heading import.

## Production deployment guide

This repository includes deployment-ready source, **not an already deployed service**. To create a reviewer-accessible live URL:

1. Create a free/available PostgreSQL database on Supabase or another managed provider. Copy the connection URL.
2. Deploy `backend/` as a Render Web Service (Docker runtime, root directory `backend`). Set `DATABASE_URL` to the database URL and `CORS_ORIGINS` to the exact Vercel frontend origin, such as `https://collabdocs-example.vercel.app` (no trailing slash). Render free plans may sleep; confirm availability before sharing.
3. Deploy `frontend/` on Vercel with framework Vite, build command `npm run build`, output `dist`, and `VITE_API_URL=https://YOUR-RENDER-API.onrender.com`.
4. Redeploy the API if its CORS origin changed. Test create → edit → refresh → share → switch user → reopen → revoke → import on the **live** URL.
5. Paste the real, verified URLs into `deployment-url.txt`, `walkthrough-video-url.txt`, and `SUBMISSION.md`.

Provider pricing and free-tier availability can change. Use a no-cost plan if available; do not ask reviewers to purchase anything. The deployment is not complete until the URLs are filled in and the smoke test passes.

## Design and limitations

- Content uses TipTap JSON for faithful rich-text persistence.
- Autosave is debounced by 650 ms and sequentially sent to the backend to avoid out-of-order saves in one browser session. Wait for the saved indicator before refreshing.
- Shared users have editor access; only owners may invite/revoke or delete. No view-only role.
- No simultaneous collaborative editing, operational transforms, conflict resolution, comments, or version history.
- Demo identity is intentionally not secure. No production authentication or rate limiting.
- No `.docx` or PDF upload. Markdown support is intentionally limited.
- No schema migrations; tables are created on startup.

See `ARCHITECTURE.md`, `AI_WORKFLOW.md`, and `SUBMISSION.md` for implementation and delivery decisions.
