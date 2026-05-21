# Job Application Accountability Tracker (Phases 1-3)

Current scope includes:
- Applications CRUD
- Tasks CRUD
- Review Queue foundation with approval workflow
- Gmail manual scan (read-only) that creates pending ReviewItems only

Out of scope right now:
- Google Sheets sync
- Daily report emails
- Mentor/family accounts
- Full auth system beyond Gmail OAuth callback flow

## Environment variables

Create `.env` from `.env.example` and set:

```env
DATABASE_URL="file:/absolute/path/to/job_app_tracker/prisma/dev.db"
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=
GMAIL_SCAN_DAYS=7
```

Recommended OAuth redirect URI:
- `http://localhost:3000/api/gmail/callback`

## Install and setup

```bash
npm install
npm run db:migrate -- --name add_gmail_scan
npx prisma generate
npm run db:seed
npm run dev
```

## Pages

- `/` dashboard
- `/applications`
- `/tasks`
- `/review`
- `/settings`

## Gmail manual scan flow

1. Open `/settings`
2. Click **Connect Gmail**
3. Complete Google OAuth consent
4. Open `/review`
5. Click **Scan Gmail**
6. Review pending items in grouped sections and approve/edit/ignore

## Privacy behavior

The app only stores limited metadata:
- `gmailMessageId`, `threadId`, sender, subject, received date
- detected type, confidence
- extracted company/role/suggested status/task title
- limited extracted metadata JSON

The app does **not** store:
- full email body
- full email thread
- attachments
- raw full Gmail payload

Email snippet is used in memory for classification and discarded.

## API routes

Gmail connection:
- `GET /api/gmail/status`
- `GET /api/gmail/connect`
- `GET /api/gmail/callback`
- `POST /api/gmail/disconnect`

Gmail scan:
- `POST /api/gmail/scan`
- `GET /api/gmail/scan-history`

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

## Quality checks

```bash
npm run lint
npm run build
```

## Notes / TODOs

- Tokens are stored in SQLite for local MVP only. Add encryption-at-rest before production use.
- Gmail scope is read-only: `https://www.googleapis.com/auth/gmail.readonly`.
- Gmail scan never creates Applications/Tasks directly; it only creates pending ReviewItems.
