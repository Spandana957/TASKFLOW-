# TaskFlow — Smart Daily Productivity Platform

**Plan Your Day. Focus on What Matters. Achieve More.**

A full-stack productivity app: tasks, smart notes, Pomodoro/stopwatch time tracking, calendar, goals, analytics and **real server-side email reminders via Resend**.

| Layer | Stack |
|---|---|
| Frontend (`client/`) | React 18, Vite, TypeScript, Tailwind CSS, Zustand, Recharts, React Router, DOMPurify |
| Backend (`server/`) | Node.js, Express, TypeScript, MongoDB/Mongoose, JWT, Zod, Resend, BullMQ + Redis (optional), Web Push |

## Features

- **Auth** — register/login with bcrypt + JWT; every query is scoped to the authenticated user.
- **Dashboard** — daily progress vs. goal, due/overdue counts, focus time, streak, 7-day chart.
- **Tasks** — full CRUD, priorities (Low/Medium/High/Urgent), due dates, tags, estimates, status, search, filter & sort.
- **Recurring tasks** — daily / weekdays / weekly / monthly; completing one creates the next occurrence on the server.
- **Smart notes** — rich text (bold, italic, underline, strike, headings, lists, quotes, **highlighting**), colors, pinning, search, autosave. HTML is sanitized with DOMPurify.
- **Focus** — Pomodoro with configurable focus/short/long breaks, stopwatch, manual time entry; sessions are logged per task (time tracking).
- **Calendar** — day, week and month views with priority color-coding and quick-add.
- **Goals** — daily/weekly goals measured by tasks completed, focus minutes (automatic), or manual check-ins.
- **Analytics** — created vs. completed, focus minutes per day, open tasks by priority, completion rate — all computed from real data.
- **Reminders** — custom date/time, per-channel (email / push / in-app), scheduling, cancellation, snooze, history with **per-reminder email delivery status**, duplicate prevention.
- **Notifications** — in-app notification center + browser notifications; Web Push (service worker) when VAPID keys are configured.
- **Themes** — light / dark / system, saved per user. Responsive layout with mobile bottom nav.
- **Settings** — profile, theme, notification preferences, Pomodoro lengths, goals.

### How reminders work

1. `POST /api/reminders` stores the reminder in MongoDB with a unique `(user, dedupeKey)` index (same task/title at the same minute → `409`).
2. If `REDIS_URL` is set, a BullMQ delayed job is created with `jobId = reminder id` (no duplicate jobs). Otherwise a server-side MongoDB poller checks every 30s.
3. On delivery the reminder is atomically claimed (`scheduled → processing`), so it is never delivered twice.
4. The email recipient is **always the authenticated user's registered email** (never taken from the request). Resend is called with an idempotency key.
5. Status is recorded honestly: `sent` only when Resend returns a message id; `failed` with the error; `not_configured` when keys are missing. Delivery is never faked.

## Environment variables

`server/.env` (copy from `server/.env.example`):

| Variable | Required | Purpose |
|---|---|---|
| `MONGODB_URI` | ✅ | MongoDB connection string |
| `JWT_SECRET` | ✅ | Long random string for signing tokens |
| `PORT` | | API port (default 4000) |
| `CLIENT_ORIGIN` | | Allowed CORS origin(s), comma-separated (default `http://localhost:5173`) |
| `RESEND_API_KEY` | for email | Resend API key |
| `EMAIL_FROM` | for email | Verified sender, e.g. `TaskFlow <reminders@yourdomain.com>` |
| `REDIS_URL` | optional | Enables BullMQ; otherwise MongoDB poller is used |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | optional | Web Push (`npx web-push generate-vapid-keys`) |

`client/.env` (optional): `VITE_API_URL` — API origin in production. In development, Vite proxies `/api` to `http://localhost:4000`.

No secrets are ever sent to the frontend.

## Run locally (Windows PowerShell)

Prerequisites: Node.js 20+, MongoDB running locally (or a MongoDB Atlas URI). Redis is optional.

```powershell
git clone https://github.com/nvaltryek-001/TASKFLOW-.git
cd TASKFLOW-

# Backend
cd server
npm install
Copy-Item .env.example .env
# edit .env: set MONGODB_URI, JWT_SECRET, and (for email) RESEND_API_KEY + EMAIL_FROM
notepad .env
npm run dev          # API on http://localhost:4000

# Frontend (new PowerShell window)
cd TASKFLOW-\client
npm install
npm run dev          # App on http://localhost:5173
```

Tests and builds:

```powershell
cd server; npm test; npm run build
cd ..\client; npm run build
```

Server tests use `mongodb-memory-server` (downloads a MongoDB binary on first run).

## API overview

All routes except `/api/auth/register`, `/api/auth/login` and `/api/health` require `Authorization: Bearer <token>`.

| Method | Path | |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login` | Auth |
| GET / PATCH | `/api/auth/me`, `/api/auth/settings` | Profile & settings |
| GET | `/api/auth/integrations` | Which integrations are configured |
| POST / DELETE | `/api/auth/push-subscriptions` | Web Push subscription |
| GET POST / GET PATCH DELETE | `/api/tasks`, `/api/tasks/:id` | Tasks (`?search=&status=&priority=&tag=&from=&to=&sort=`) |
| GET POST / PATCH DELETE | `/api/notes`, `/api/notes/:id` | Notes |
| GET POST | `/api/reminders` | List / schedule |
| POST | `/api/reminders/:id/cancel`, `/api/reminders/:id/snooze` | Cancel / snooze |
| DELETE | `/api/reminders/:id` | Remove |
| GET POST | `/api/notifications`, `/api/notifications/read-all` | In-app history |
| GET POST DELETE | `/api/time` | Time entries |
| GET POST PATCH DELETE | `/api/goals` | Goals |
| GET | `/api/analytics?days=14` | Analytics |
