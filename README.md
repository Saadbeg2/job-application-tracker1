# Job Application Accountability Tracker (Phase 1)

Phase 1 includes:
- Next.js + TypeScript app
- Prisma ORM + SQLite
- Applications CRUD
- Tasks CRUD
- Dashboard summary analytics

## 1) Install

```bash
npm install
```

## 2) Configure database

`.env` is already configured for local SQLite.

```env
DATABASE_URL="file:/Users/saadbeg/Documents/GitHub/job_app_tracker/prisma/dev.db"
```

If you clone this project into a different folder, update `DATABASE_URL` to your absolute path.

## 3) Run migration

```bash
npm run db:migrate -- --name init
```

## 4) Run the app

```bash
npm run dev
```

Open `http://localhost:3000`.

## 5) Available pages

- `/` dashboard
- `/applications` applications CRUD
- `/tasks` tasks CRUD

## API routes

Applications:
- `GET /api/applications`
- `POST /api/applications`
- `GET /api/applications/[id]`
- `PUT /api/applications/[id]`
- `DELETE /api/applications/[id]`

Tasks:
- `GET /api/tasks`
- `POST /api/tasks`
- `GET /api/tasks/[id]`
- `PUT /api/tasks/[id]`
- `DELETE /api/tasks/[id]`

Analytics:
- `GET /api/analytics/summary`

## Quality checks

```bash
npm run lint
npm run build
```

## Notes

- No auth yet.
- No Gmail, Google Sheets, or email reporting integrations yet.
- No Redis/RabbitMQ.
- For local analytics testing, you can set:
  - `ANALYTICS_TODAY_OVERRIDE=YYYY-MM-DD` to force the dashboard/API "today" date.
  - `ANALYTICS_DEBUG=true` to log Chicago today key and per-application date-key counting.
