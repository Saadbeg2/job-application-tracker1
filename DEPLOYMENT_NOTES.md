# Deployment Notes

This repo is being prepared for GitHub, Vercel, and Neon, but it is not ready for public deployment yet.

Do not deploy this app publicly until admin auth environment variables are configured, the database plan is finalized, and production callbacks/schedulers are reviewed.

## Current State

- Next.js + TypeScript app.
- Prisma uses Postgres through `prisma/schema.prisma`.
- Neon Postgres should be used for production `DATABASE_URL`.
- Gmail OAuth/API, Google Sheets API, and SMTP reporting all depend on environment variables.
- Daily reports are exposed through an API route and require an external scheduler or Vercel Cron configuration to run automatically.
- App-level admin-only Google login protects app pages and private API routes.

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a local `.env` from `.env.example` and fill in local values. Do not commit `.env`.

3. For local Postgres development, set:

   ```env
   DATABASE_URL="postgresql://<user>:<password>@<host>/<database>?sslmode=require"
   GOOGLE_REDIRECT_URI="http://localhost:3000/api/gmail/callback"
   APP_BASE_URL="http://localhost:3000"
   AUTH_URL="http://localhost:3000"
   ADMIN_EMAIL="your-email@example.com"
   GUEST_ACCESS_CODE="shared-code-for-read-only-dashboard"
   DEMO_MODE="false"
   DEMO_GUEST_ACCESS_CODE="optional-demo-only-guest-code"
   ```

4. Apply local Prisma migrations and generate the client:

   ```bash
   npm run db:migrate
   npm run db:generate
   ```

5. Start the app:

   ```bash
   npm run dev
   ```

## GitHub Push Checklist

- Confirm `.env` is ignored and not tracked.
- Confirm local database files are ignored and not tracked:
  - `prisma/dev.db`
  - `prisma/dev.db-journal`
  - `*.db`
  - `*.sqlite`
  - `*.sqlite3`
- Confirm `.env.example` contains placeholders only.
- Review `git status --short` before committing so unrelated local work is not included accidentally.
- Keep the GitHub repository private while the app has no auth.

## Neon Setup Checklist

- Create a Neon project.
- Create a production database and role.
- Copy the pooled or direct Postgres connection string for Vercel.
- Store it in Vercel as `DATABASE_URL`.
- Do not use the old local SQLite `file:./dev.db` URL in Vercel.
- Apply the fresh Postgres migration to an empty Neon database first.

## Vercel Setup Checklist

- Import the private GitHub repository into Vercel.
- Use Vercel Hobby only after auth is implemented or while the project remains inaccessible for real use.
- Set all required environment variables in Vercel Project Settings.
- Configure build command:

  ```bash
  npm run build
  ```

- Add an automatic report trigger later using Vercel Cron or another scheduler that calls the daily report route.
- Add route/API protection before enabling real production usage.

## Google OAuth Redirect URL Checklist

Google OAuth redirect URIs must exactly match the deployed callback URL.

For local Gmail/Sheets connection:

```text
http://localhost:3000/api/gmail/callback
```

For Vercel production later:

```text
https://<your-vercel-domain>/api/gmail/callback
```

For local app login:

```text
http://localhost:3000/api/auth/callback
```

For Vercel app login later:

```text
https://<your-vercel-domain>/api/auth/callback
```

Update both:

- Google Cloud Console OAuth client redirect URI.
- Vercel `GOOGLE_REDIRECT_URI` environment variable.
- Vercel `AUTH_URL` environment variable.

The app currently requests Gmail read-only and Google Sheets scopes during the same Google OAuth flow.

## Environment Variable Checklist

### Database

- `DATABASE_URL`

### App base URL / callback URL

- `APP_BASE_URL`
- `GOOGLE_REDIRECT_URI`

### Admin app authentication

- `AUTH_SECRET`
- `AUTH_URL`
- `GOOGLE_AUTH_CLIENT_ID`
- `GOOGLE_AUTH_CLIENT_SECRET`
- `ADMIN_EMAIL`
- `GUEST_ACCESS_CODE`
- `DEMO_MODE`
- `DEMO_GUEST_ACCESS_CODE`

### Google OAuth / Gmail

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GMAIL_SCAN_DAYS`

### Google Sheets

- `GOOGLE_SHEETS_DEFAULT_TITLE`
- `GOOGLE_SHEETS_SPREADSHEET_ID`
- `GOOGLE_SHEETS_SPREADSHEET_URL`

### SMTP reporting

- `EMAIL_PROVIDER`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `REPORT_FROM_EMAIL`
- `REPORT_FROM_NAME`

### Analytics / local debugging

- `ANALYTICS_TODAY_OVERRIDE`
- `ANALYTICS_DEBUG`

## Deployment Blockers

- Old SQLite migrations are archived and should not be applied to Neon Postgres.
- Local SQLite files cannot be used on Vercel because serverless filesystems are ephemeral.
- Gmail OAuth callback URL must be changed to the production Vercel URL before production OAuth use.
- Auth Google OAuth callback URL must be added for production: `https://<your-vercel-domain>/api/auth/callback`.
- Daily reports will not run automatically unless Vercel Cron or another scheduler is configured.
- Gmail access tokens and refresh tokens are stored in the database in local MVP style; production should consider encryption at rest.

## Prisma / Postgres Readiness Plan

Prisma is configured for Postgres. The active migration path is intended for a fresh Neon database.

1. Set `DATABASE_URL` to a Neon Postgres URL:

   ```text
   postgresql://<user>:<password>@<host>/<database>?sslmode=require
   ```

2. Generate Prisma Client:

   ```bash
   npx prisma generate
   ```

3. Apply the fresh Postgres migration to an empty Neon database:

   ```bash
   npx prisma migrate deploy
   ```

4. For local development with a disposable Postgres database, use:

   ```bash
   npx prisma migrate dev
   ```

Schema notes:

- The current Prisma models use common Prisma field types, enums, `@default(now())`, `@updatedAt`, indexes, and relations that are generally Postgres-compatible.
- The old SQLite migration history is preserved outside the active Prisma migration path for reference.
- No obvious SQLite-only field defaults were found in `prisma/schema.prisma`.

## Auth / Access-Control Notes

- The app uses a minimal Google OAuth login for admin-only access.
- `ADMIN_EMAIL` is the only email allowed to create a valid app session.
- `GUEST_ACCESS_CODE` enables the read-only guest dashboard. Store it only in local/Vercel environment variables and rotate it if shared too broadly.
- App sessions are signed with `AUTH_SECRET` and stored in an HTTP-only cookie.
- Guest sessions are also signed with `AUTH_SECRET`, stored in a separate HTTP-only cookie, and expire after about 7 days.
- The auth login flow uses `GOOGLE_AUTH_CLIENT_ID` and `GOOGLE_AUTH_CLIENT_SECRET`.
- If `GOOGLE_AUTH_CLIENT_ID` / `GOOGLE_AUTH_CLIENT_SECRET` are not set, auth falls back to the existing `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, but separate OAuth credentials are safer because app login and Gmail/Sheets access use different callback URLs and scopes.
- Private pages and APIs are protected by `proxy.ts`.
- Static assets, `/api/auth/*`, and the guest access-code endpoints remain public.
- Guest users can access only `/` and the read-only guest summary API.

## Safe Demo Environment

Use a separate database and separate environment for demos. Do not point demo mode at the production Neon database.

Demo mode is controlled by:

```env
DEMO_MODE="true"
DEMO_GUEST_ACCESS_CODE="<shared-demo-access-code>"
```

When `DEMO_MODE=true`:

- The app shows a visible “Demo Mode — sample data only” banner.
- The Review Queue Gmail scan button runs a local sample-email scan and does not call Gmail.
- Google Sheets sync/create/connect endpoints are disabled and return friendly JSON errors.
- Guest dashboard hides real Google Sheet links.
- Daily report send endpoints are disabled and do not send email.
- Demo helper endpoints require `DEMO_MODE=true`.

Seed a demo database with:

```bash
npm run seed:demo
```

The seed script refuses to run unless `DEMO_MODE=true`. It clears the connected demo database and inserts sample Applications, Tasks, ReviewItems, and Guest Company Suggestions. Verify `DATABASE_URL` points to a disposable demo database before running it.

## Secret Safety Notes

- `.env` must remain untracked.
- `.env.example` must contain placeholders only.
- Never commit OAuth client secrets, SMTP app passwords, database passwords, Gmail tokens, refresh tokens, or local SQLite database files.
