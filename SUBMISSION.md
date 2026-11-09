# CollabDocs submission manifest

## Included

- `frontend/`: React + TypeScript + TipTap UI and styling
- `backend/`: FastAPI + SQLAlchemy API, PostgreSQL/SQLite support, pytest tests, Dockerfile
- `README.md`: setup, local run, testing, sharing demo, deployment guide, limitations
- `ARCHITECTURE.md`: product slice, API, data model, tradeoffs, next steps
- `AI_WORKFLOW.md`: AI tools, acceleration, review and verification disclosure
- `docker-compose.yml`: local PostgreSQL
- `deployment-url.txt`: placeholder for live product URL
- `walkthrough-video-url.txt`: placeholder for recorded walkthrough URL
- `WALKTHROUGH_SCRIPT.md`: 3–5 minute video outline
- `screenshots/`: placeholder directory; screenshots not yet captured

## External deliverables still required

- **Live product URL:** NOT DEPLOYED — fill in after Vercel/Render/PostgreSQL setup.
- **Walkthrough video:** NOT RECORDED — fill in after recording and uploading.
- **Google Drive folder:** NOT CREATED — upload this source folder and share a reviewer-accessible link.
- **Screenshots:** NOT CAPTURED — optional when a working live demo is available.

## Demo accounts

Alex Morgan: `alex@demo.local`  
Sam Rivera: `sam@demo.local`

Use the bottom-left account switcher. No password is required because this is intentionally simulated authentication.

## Functionality status

**Implemented in source:** create/rename/edit/save/reopen/delete, formatting, file import, demo-user sharing, persistent database models, backend authorization, API tests.

**Not implemented:** real-time concurrent collaboration, real login, view-only roles, comments, document versioning, DOCX import.

**Validation:** See actual test/build status after running checks; the source itself is not proof of a working hosted deployment.

## Next 2–4 hours

Add real auth, migration support, optimistic conflict detection, and an end-to-end browser test.
