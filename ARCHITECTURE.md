# Architecture and prioritization

## Product slice

The primary journey is create → format → autosave → reopen → share → edit as second user. This exercises frontend UX, API integration, persistence, and server-side authorization within a constrained timebox.

## Components

- **React / TypeScript / Vite**: dashboard, account switcher, document editor, share dialog, import UI, save indicator.
- **TipTap**: structured JSON editor model; StarterKit + Underline for common formatting.
- **FastAPI / Pydantic**: REST endpoints, request validation, file validation, ownership checks.
- **SQLAlchemy / PostgreSQL**: `users`, `documents`, `shares`; SQLite supported for zero-config local testing.
- **Deployment**: Vercel for static frontend, Render Docker web service for API, managed PostgreSQL for persistence. Deployment requires user-owned hosting accounts and configuration.

## Data model

`users(id, name, email UNIQUE)`

`documents(id, title, content JSON-as-text, owner_id FK users, updated_at)`

`shares(id, document_id FK documents, user_id FK users, role, UNIQUE(document_id,user_id))`

Storing editor JSON as text keeps SQLite and PostgreSQL behavior consistent and avoids lossy HTML round-trips. For production PostgreSQL, JSONB with migrations would improve querying and validation.

## API endpoints

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/health` | Health check |
| GET | `/users` | List demo accounts |
| GET/POST | `/documents` | List accessible documents / create |
| GET/PATCH/DELETE | `/documents/{id}` | Read / edit / owner delete |
| POST | `/documents/{id}/share` | Owner grants editor access by email |
| DELETE | `/documents/{id}/share/{user_id}` | Owner revokes access |
| POST | `/documents/import` | UTF-8 `.txt` / `.md` upload to new document |

Every document endpoint resolves the `X-User-Id` demo identity and checks ownership or a share row. Sharing and deletion are owner-only.

## Tradeoffs

1. **Demo identities instead of auth**: reviewers can test the full sharing flow immediately, but this is not production authentication.
2. **Autosave instead of manual save**: a simple debounce with sequential writes gives clear UX without websockets. Concurrent edits in multiple browsers use last-write-wins.
3. **Limited import**: UTF-8 text and Markdown headings offer a real file workflow without expensive DOCX parsing.
4. **Structured content**: TipTap JSON retains headings, marks, and lists across reloads.
5. **No real-time collaboration**: operational transforms / CRDTs are too risky for this timebox. Sharing is asynchronous collaboration.

## Validation and reliability

- Pydantic validates titles, share role, and editor document root.
- Import validates extension, size (250 KB), and UTF-8 decoding.
- Backend rejects unshared access, unauthorized delete, and unauthorized sharing.
- Frontend displays API failures and save status.
- Pytest covers permission boundaries and imports.

## Next 2–4 hours

1. Replace demo identity with actual sign-in/session auth and server-verified user claims.
2. Add Alembic migrations and richer document schema validation.
3. Add optimistic revision numbers to detect concurrent edits.
4. Add integration/browser tests for create → share → switch → reopen and improve keyboard accessibility.
