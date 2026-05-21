# Job Application Accountability Tracker (Phase 1 + Phase 2)

This project currently includes:
- Next.js + TypeScript app
- Prisma ORM + SQLite
- Applications CRUD
- Tasks CRUD
- Dashboard summary analytics
- Review Queue foundation (`/review`) with approval workflows

No Gmail OAuth, Google Sheets sync, daily report emails, or authentication are implemented yet.

## 1) Install

```bash
npm install
```

## 2) Configure database

`.env` is configured for local SQLite.

```env
DATABASE_URL="file:/Users/saadbeg/Documents/GitHub/job_app_tracker/prisma/dev.db"
```

If you clone this project elsewhere, update to your local absolute path.

## 3) Run migration

```bash
npm run db:migrate -- --name init
```

## 4) Seed sample review queue data

```bash
npm run db:seed
```

Seed includes:
- one `new_application` review item
- one `status_update` review item
- one `task` review item
- one `unknown_job_related` review item

## 5) Run app

```bash
npm run dev
```

Open `http://localhost:3000`.

## Pages

- `/` dashboard
- `/applications` applications CRUD
- `/tasks` tasks CRUD
- `/review` review queue

## Review queue flow

- Pending items are grouped into:
  - Possible New Applications
  - Possible Status Updates
  - Possible Tasks / Action Required
  - Other Job-Related Emails
- Per item actions:
  - Approve
  - Edit & Approve
  - Ignore
  - Not Relevant
- Status update approval requires selecting one specific application.
- New application approval performs duplicate checks and warns before forced approval.
- Unknown job-related items must be converted (via Type + Edit & Approve) before approval.

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

Review items:
- `GET /api/review-items`
- `POST /api/review-items`
- `GET /api/review-items/[id]`
- `PUT /api/review-items/[id]`
- `DELETE /api/review-items/[id]`
- `POST /api/review-items/[id]/approve`
- `POST /api/review-items/[id]/ignore`
- `POST /api/review-items/[id]/not-relevant`
- `GET /api/review-items/[id]/matches`

Analytics:
- `GET /api/analytics/summary`

## Quality checks

```bash
npm run lint
npm run build
```

## Optional local analytics testing

- `ANALYTICS_TODAY_OVERRIDE=YYYY-MM-DD`
- `ANALYTICS_DEBUG=true`
