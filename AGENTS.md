# Delivery Repo Notes for OpenCode

## Scope and layout
- This repo is split into two independent projects: `client/` (Vite + React + TypeScript) and `server/` (FastAPI + SQLAlchemy + Socket.IO). There is no root workspace manifest.
- Ignore `client/node_modules/` and `client/dist/` during code search; they are present and create heavy noise.
- `smartroute.html` at repo root is a standalone prototype file, not the runtime entrypoint for the React app.

## Run and verify commands
- Frontend (from `client/`): `npm run dev`, `npm run lint`, `npm run build`.
- Backend: create venv, install `requirements.txt`, then `python run.py` from `server/`.
- Backend startup (`server/app/main.py` lifespan) auto-creates tables, runs schema migrations via raw SQL ALTER TABLE, and seeds demo data on empty DB.
- If `restaurants_cleaned.csv` exists at the repo root, it is loaded into the DB on first startup (zone-filtered around Hyderabad). The CSV path in lifespan is `../restaurants_cleaned.csv` relative to `server/`. Backend logs: `[Startup] Loaded restaurants from CSV (zone filtered)` or `[Startup] Could not load restaurants from CSV: <error>`.
- Seeded logins: `admin@smartroute.in` / `admin1234`, `demo@smartroute.in` / `demo1234`, `arjun@smartroute.in` / `demo1234`.
- There is no test suite in this repo.

## Environment and state gotchas
- Backend commands require `cwd=server/`; `.env` loads from that directory (`app/config.py`) and SQLite path is relative (`sqlite:///./smartroute.db`).
- `.env` is gitignored; `server/.env.example` exists. Copy it to `server/.env` before first run.
- Frontend API base URL comes from `VITE_API_URL`; default is `http://localhost:8000` (`client/src/services/api.ts` and `client/src/contexts/SocketContext.tsx`).
- Login endpoint matches role (`server/app/routers/auth.py:80`): a user must log in with their correct role (e.g. a delivery user cannot log in as `customer`).

## Architecture facts that matter for edits
- `socket_app = _socketio.ASGIApp(sio, app)` in `app/main.py` wraps the FastAPI app; running `python run.py` uses `app.main:socket_app`.
- API routers are wired in `server/app/main.py`; add new endpoints via router modules under `server/app/routers/` and include them there.
- Auth and role enforcement live in `server/app/routers/auth.py` (`get_current_user`, `require_role`); follow this pattern for protected endpoints.
- Real-time events are managed in `server/app/main.py` + `server/app/sio_server.py`; client listeners are in `client/src/contexts/SocketContext.tsx`.
- Frontend route guarding is centralized in `client/src/App.tsx` (`ProtectedRoute` + role-based redirects). Keep role strings lowercase: `customer`, `delivery`, `admin`.
