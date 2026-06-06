# Deployment Notes

This repo is being prepared for GitHub, Vercel, and Neon, but it is not ready for public deployment yet.

Do not deploy this app publicly until admin auth environment variables are configured, the database plan is finalized, and production callbacks/schedulers are reviewed.

## Current State

- Next.js + TypeScript app.
- Prisma currently uses SQLite through `prisma/schema.prisma`.
- Local database is expected at `prisma/dev.db` when `DATABASE_URL` uses `file:./dev.db`.
- Gmail OAuth/API, Google Sheets API, and SMTP reporting all depend on environment variables.
- Daily reports are exposed through an API route and require an external scheduler or Vercel Cron configuration to run automatically.
- App-level admin-only Google login protects app pages and private API routes.

## Local Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a local `.env` from `.env.example` and fill in local values. Do not commit `.env`.

3. For local SQLite development, set:

   ```env
   DATABASE_URL="file:./dev.db"
   GOOGLE_REDIRECT_URI="http://localhost:3000/api/gmail/callback"
   APP_BASE_URL="http://localhost:3000"
   AUTH_URL="http://localhost:3000"
   ADMIN_EMAIL="your-email@example.com"
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
- Do not use the local SQLite `file:./dev.db` URL in Vercel.
- Do not migrate to Postgres until the Prisma provider and migrations have been intentionally updated.

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

- `prisma/schema.prisma` currently uses `provider = "sqlite"`.
- Existing migrations are SQLite migrations; they are not ready to apply directly to Neon Postgres.
- Local SQLite files cannot be used reliably on Vercel because serverless filesystems are ephemeral.
- Gmail OAuth callback URL must be changed to the production Vercel URL before production OAuth use.
- Auth Google OAuth callback URL must be added for production: `https://<your-vercel-domain>/api/auth/callback`.
- Daily reports will not run automatically unless Vercel Cron or another scheduler is configured.
- Gmail access tokens and refresh tokens are stored in the database in local MVP style; production should consider encryption at rest.

## Prisma / Postgres Readiness Plan

Do not migrate yet.

When ready to move from SQLite to Neon Postgres:

1. Update `prisma/schema.prisma`:

   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

2. Update production `DATABASE_URL` to a Neon Postgres URL:

   ```text
   postgresql://<user>:<password>@<host>/<database>?sslmode=require
   ```

3. Regenerate migrations for Postgres instead of applying the current SQLite migration SQL to Neon directly.

4. Run locally against a disposable Postgres database first:

   ```bash
   npm run db:generate
   npx prisma migrate dev --name init_postgres
   ```

5. Apply production migrations after review:

   ```bash
   npx prisma migrate deploy
   ```

6. Generate Prisma Client during deployment:

   ```bash
   npm run db:generate
   ```

Schema notes:

- The current Prisma models use common Prisma field types, enums, `@default(now())`, `@updatedAt`, indexes, and relations that are generally Postgres-compatible.
- The main migration issue is the existing SQLite migration history and `prisma/migrations/migration_lock.toml`, which currently records `provider = "sqlite"`.
- No obvious SQLite-only field defaults were found in `prisma/schema.prisma`, but generated SQL migrations must still be reviewed before production.

## Auth / Access-Control Notes

- The app uses a minimal Google OAuth login for admin-only access.
- `ADMIN_EMAIL` is the only email allowed to create a valid app session.
- App sessions are signed with `AUTH_SECRET` and stored in an HTTP-only cookie.
- The auth login flow uses `GOOGLE_AUTH_CLIENT_ID` and `GOOGLE_AUTH_CLIENT_SECRET`.
- If `GOOGLE_AUTH_CLIENT_ID` / `GOOGLE_AUTH_CLIENT_SECRET` are not set, auth falls back to the existing `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, but separate OAuth credentials are safer because app login and Gmail/Sheets access use different callback URLs and scopes.
- Private pages and APIs are protected by `proxy.ts`.
- Static assets and `/api/auth/*` remain public.
- Add an optional viewer role later if read-only sharing becomes useful.

## Secret Safety Notes

- `.env` must remain untracked.
- `.env.example` must contain placeholders only.
- Never commit OAuth client secrets, SMTP app passwords, database passwords, Gmail tokens, refresh tokens, or local SQLite database files.
