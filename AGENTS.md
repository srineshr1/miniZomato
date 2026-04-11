# Delivery Repo Notes for OpenCode

## Scope and layout
- This repo is split into two independent projects: `client/` (Vite + React + TypeScript) and `server/` (FastAPI + SQLAlchemy + Socket.IO). There is no root workspace manifest.
- Ignore `client/node_modules/` and `client/dist/` during code search; they are present and create heavy noise.
- `smartroute.html` at repo root is a standalone prototype file, not the runtime entrypoint for the React app.

## Run and verify commands
- Frontend (from `client/`): `npm run dev`, `npm run lint`, `npm run build`.
- Backend (from `server/`): create venv + install `requirements.txt`, then run `python run.py`.
- Backend runtime target is `app.main:socket_app` (Socket.IO-wrapped app), not plain `app.main:app`.
- No repo test suite/config is present; for backend sanity checks use `GET /health` and `GET /docs` after startup.

## Environment and state gotchas
- Run backend commands with cwd=`server/`; `.env` is loaded from that directory (`app/config.py`) and SQLite path is relative (`sqlite:///./smartroute.db`).
- Frontend API base URL comes from `VITE_API_URL`; default is `http://localhost:8000` (`client/src/services/api.ts` and `client/src/contexts/SocketContext.tsx`).
- Backend startup (`server/app/main.py` lifespan) auto-creates tables and seeds demo accounts/data on empty DB.
- Seeded logins are hardcoded: `admin@smartroute.in` / `admin1234`, `demo@smartroute.in` / `demo1234`, `arjun@smartroute.in` / `demo1234`.

## Architecture facts that matter for edits
- API routers are wired in `server/app/main.py`; add new endpoints via router modules under `server/app/routers/` and include them there.
- Auth and role enforcement live in `server/app/routers/auth.py` (`get_current_user`, `require_role`); follow this pattern for protected endpoints.
- Real-time events are managed in `server/app/main.py` + `server/app/sio_server.py`; client listeners are in `client/src/contexts/SocketContext.tsx`.
- Frontend route guarding is centralized in `client/src/App.tsx` (`ProtectedRoute` + role-based redirects). Keep role strings lowercase: `customer`, `delivery`, `admin`.
