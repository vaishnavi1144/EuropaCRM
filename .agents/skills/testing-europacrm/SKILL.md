---
name: testing-europacrm
description: How to run and test EuropaCRM locally (dev servers, seeded logins, role permissions, mail modules, API bearer tokens).
---

# Testing EuropaCRM locally

## Running the app
- `sudo service postgresql start` then `npm run dev` from the repo root → API on :4000, web on :5173.
- The root `npm run dev` starts BOTH API and web via `concurrently`. If an API is already running you will
  see `EADDRINUSE :::4000` from the `[API]` process while the `[WEB]` (vite) process still starts fine —
  that is harmless. Check `curl -s -o /dev/null -w '%{http_code}' localhost:4000/api/health` first and, if the
  API is already up, only the web side is needed.
- The running API's stdout/stderr may be redirected to a file (e.g. `/tmp/api.log`). If you did not start it
  yourself, find it with `ls -l /proc/<pid>/fd/1` for the `tsx ... src/index.ts` process — useful for checking
  for unhandled backend errors after a UI run.

## Logins (seeded by `npm run db:seed`)
- Super admin: `admin` / `admin123` (env-overridable via ADMIN_USERNAME/ADMIN_PASSWORD).
- Role users (all BENCHSALES): `harsha`, `veeru`, `saikumar`, `ramesh`, `pavan` — password `recruiter123`.
- There are no seeded SALES / RECRUITER / AITEAM users; use a BENCHSALES user to test "lacks permission X"
  cases (e.g. they lack `sales-mail-view`, so `/s-mail` must redirect them away).

## Permissions model
- `backend/src/lib/permissions.ts` → `ROLE_DEFAULT_PERMISSIONS` lists each role's permissions;
  SUPER_ADMIN gets `['*']`.
- Frontend gating is `AccessGate` in `frontend/src/App.tsx`: a denied route silently `<Navigate>`s to the
  user's first allowed path (no error page), so assert on the redirect, not on an error message.

## Mail modules (Gmail stack)
- Routes: `/s-mail`, `/it-mail`, `/bench-mail`, `/ai-mail` render the shared `RoleMailPage`; the legacy SMTP
  mail-groups screen lives at `/<module>-mail/groups`.
- Per-module titles / CRM folders / link-field labels come from `frontend/src/data/roleMailConfigs.ts` — a
  good way to prove the page is genuinely parameterized rather than one hard-coded screen.
- API is `/api/role-mail/:module/*` with module ∈ `sales|it|bench|ai`; permission prefixes are
  sales→`sales-mail`, it→`recruitment-mail`, bench→`bench-mail`, ai→`ai-mail`.
- Without Google OAuth env vars, everything still renders: a "connect Gmail" banner, a read-only From field,
  a disabled Send button, and Sync shows a toast "No Gmail account connected…". Real Gmail
  send/receive/sync/threading cannot be tested without credentials — say so rather than faking it.
- Settings → "Email Accounts" tab shows an amber warning when `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`
  are unset and disables "Connect with Google" (note: the button keeps its primary/teal styling even when
  disabled, so verify via a click producing no navigation rather than by colour).

## API testing with bearer tokens
```
TOKEN=$(curl -s -X POST localhost:4000/api/auth/login -H 'content-type: application/json' \
  -d '{"username":"admin","password":"admin123"}' | jq -r .token)
curl -H "Authorization: Bearer $TOKEN" localhost:4000/api/role-mail/sales/folders
```
Labels are the cheapest way to prove per-user/per-module isolation without a mailbox:
`POST /api/role-mail/<module>/labels {"name":"..."}` as two different users, then `GET` as each — they must
see only their own. Created labels also show up in the RoleMailPage sidebar, which makes the isolation
visible in a recording. Clean up with `DELETE /api/role-mail/<module>/labels/<id>`.

## Devin Secrets Needed
- None for the flows above. Real Gmail flows would need `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
  `GOOGLE_OAUTH_REDIRECT_URI`, `GOOGLE_TOKEN_ENCRYPTION_KEY` in `backend/.env`.
