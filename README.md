# Job Application Accountability Tracker (Phases 1-4)

Current scope includes:
- Applications CRUD
- Tasks CRUD
- Review Queue + approval workflow
- Gmail manual scan to create pending ReviewItems
- Google Sheets sync (manual create/connect + re-sync)

Out of scope right now:
- Daily report emails
- Mentor/family accounts
- Public sharing
- Phase 5 features

## Environment variables

Use `.env` (do not commit secrets):

```env
DATABASE_URL="file:./dev.db"
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=http://localhost:3000/api/gmail/callback
GMAIL_SCAN_DAYS=7
GOOGLE_SHEETS_DEFAULT_TITLE=Job Application Tracker
```

Optional:

```env
ANALYTICS_TODAY_OVERRIDE=
ANALYTICS_DEBUG=false
```

## Setup

```bash
npm install
npm run db:migrate -- --name add_google_sheets_sync
npx prisma generate
npm run dev
```

## Google reconnect note

Google Sheets sync requires OAuth scope:
- `https://www.googleapis.com/auth/spreadsheets`

If your existing Google connection only had Gmail read-only scope, reconnect from `/settings`.

## How to create/connect tracker sheet

1. Go to `/settings`
2. In **Google Connection**, click **Connect/Reconnect Google**
3. In **Google Sheets Sync**:
   - Click **Create Tracker Sheet** to create a new spreadsheet, or
   - Paste spreadsheet ID/URL and click **Connect Existing Sheet**

## How to re-sync

- In `/settings`, click **Re-sync Google Sheet**
- This rewrites two tabs:
  - `Applications`
  - `Tasks`

## What is synced

Applications tab columns:
- Date Applied, Company, Role, Status, Source, Job Link, Resume Used, Location, Referral, Notes, Created At, Last Updated

Tasks tab columns:
- Date Found, Company, Role, Task, Task Status, Due Date, Source Email Subject, Notes, Created At, Last Updated

Null fields sync as blank cells.

## What is NOT synced

- ReviewItems
- Gmail full email bodies
- Gmail full threads
- attachments
- raw Gmail payloads
- access/refresh tokens

## API routes

Google Sheets:
- `GET /api/google-sheets/status`
- `POST /api/google-sheets/create`
- `POST /api/google-sheets/connect`
- `POST /api/google-sheets/sync`
- `POST /api/google-sheets/disconnect`

Gmail:
- `GET /api/gmail/status`
- `GET /api/gmail/connect`
- `GET /api/gmail/callback`
- `POST /api/gmail/disconnect`
- `POST /api/gmail/scan`
- `GET /api/gmail/scan-history`

## Quality checks

```bash
npm run lint
npm run build
```

## Limitations / TODO

- Sheets sync is manual-first for reliability (Create/Re-sync buttons in Settings).
- Auto-sync hooks can be added later if desired.
- Token storage is local MVP style; add encryption-at-rest before production.
