# Europa CRM — PostgreSQL Only

Europa CRM is a React, Vite and TypeScript frontend with a Node.js, Express, TypeScript and Prisma backend. PostgreSQL is the only database. Redis and SQLite are not used.

## Prerequisites

- Node.js 22 LTS
- npm 10.9.x
- Docker Desktop for PostgreSQL

## Windows setup

Open Command Prompt in the main project folder—the folder containing `backend`, `frontend`, `package.json` and `docker-compose.yml`.

### 1. Start PostgreSQL

```cmd
docker compose up -d
docker compose ps
```

The `europa-crm-postgres` container should show `healthy` and expose PostgreSQL on `127.0.0.1:55432`.

The Compose file preserves the existing named PostgreSQL volume. Do not use `docker compose down -v` unless you deliberately want to delete all CRM data.

### 2. Create environment files

```cmd
if not exist backend\.env copy backend\.env.example backend\.env
if not exist frontend\.env copy frontend\.env.example frontend\.env
```

The default backend database connection is:

```env
DATABASE_URL=postgresql://europa:europa_password@localhost:55432/europa_crm?schema=public
```

### 3. Install packages

```cmd
npm ci --registry=https://registry.npmjs.org/ --no-audit --no-fund
```

### 4. Generate Prisma Client and apply migrations

```cmd
npm run db:generate
cd backend
npx prisma migrate deploy
cd ..
```

The migrations preserve existing business records and add persistent custom fields, system settings, secure user credentials, per-user module permissions and database-backed login sessions. The backend also performs a safe startup compatibility check so older PostgreSQL databases missing the `customData` or user `permissions` columns are repaired automatically without deleting records.

For a new schema change during development:

```cmd
cd backend
npx prisma migrate dev --name describe_the_change
cd ..
```

Do not run `prisma migrate reset` on a database containing records you need to preserve.

### 5. Create the initial administrator login

The default first-login credentials are configured in `backend\.env`:

```env
ADMIN_NAME=Europa Administrator
ADMIN_USERNAME=admin
ADMIN_EMAIL=admin@europacrm.local
ADMIN_PASSWORD=admin123
```

Create or refresh the administrator login:

```cmd
npm run db:seed
```

No mock leads, contacts, candidates, consultants, projects or revenue records are created. Change the administrator password after the first login from **Users & Roles**.

### 6. Start the application

```cmd
npm run dev
```

Open:

- Frontend: `http://localhost:5173`
- Backend health: `http://localhost:4000/api/health`

Initial login:

- Username: `admin`
- Password: `admin123`

## Functional modules

- Dashboard with live PostgreSQL totals
- Sales and Marketing: Leads, Contacts, Accounts, Opportunities, Campaigns and Activities
- IT Recruitment: Candidates, Jobs, Interviews and Offers
- Bench Sales: Bench Consultants, Submissions and Placements
- AI Team: AI Projects, Tasks and Resources
- Department-specific live reports
- Users and Access Management with module-level permission checkboxes
- System Settings

## Working record actions

Each business module supports:

- Add, view, edit and delete
- Clickable record names
- Row action menus
- Multi-row selection and bulk delete
- Selected-row and full-table CSV export
- CSV template download and validated CSV import
- Search, filters, clear filters and quick filters
- Column sorting
- First, previous, numbered, next and last-page controls
- Page sizes of 10, 25, 50 and 100
- Empty, loading and API-error states
- Custom module fields persisted with each PostgreSQL record
- Socket.IO create, update and delete events

Records are changed in the interface only after the Express API confirms the PostgreSQL operation. API failures do not produce local-only records or fake success messages.

## Reports and shared controls

- Live PostgreSQL KPI cards, charts and tables
- Date-range and daily, weekly or monthly grouping
- CSV report export
- Global search across only the modules assigned to the logged-in user
- Pending-activity notifications
- Email and calendar activity shortcuts
- User-specific login, logout and checkbox-controlled module access
- Responsive desktop, tablet and mobile navigation
- Europa CRM logo on the login screen and application sidebar

## SMTP and AWS S3

SMTP and S3 can be configured in **Settings** or through `backend\.env`. Values saved in Settings take priority so changes work without editing the environment file. Saved secret values are not returned to the browser after configuration.

Required SMTP values:

```env
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=
```

Required S3 values:

```env
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=
```

The From address may be left empty to use the SMTP username. For Gmail, use `smtp.gmail.com`, port `587`, the Gmail address as the username and a Google App Password as `SMTP_PASS`. Email and S3 operations return a real error when configuration or the external service fails; they do not return demo success responses.

## Build verification

```cmd
npm run build
```

## Useful commands

```cmd
docker compose up -d
docker compose ps
docker compose down
npm run db:generate
npm run db:seed
npm run dev
npm run build
```

## Updated login, Google sign-in and module email isolation

- The login screen now follows the supplied Europa CRM two-panel design and remains responsive on smaller screens.
- API requests stop after 20 seconds and show a clear server/timeout message instead of leaving the login page loading indefinitely.
- Google sign-in uses Google Identity Services. Create an OAuth 2.0 Web Client in Google Cloud, add the frontend origin, and set the same client ID in `frontend/.env` as `VITE_GOOGLE_CLIENT_ID` and in `backend/.env` as `GOOGLE_CLIENT_ID`.
- Google sign-in only accepts an active CRM user whose saved CRM email exactly matches the verified Google email. This preserves role and module separation.
- Outbound SMTP accounts are isolated by role: `SALES_SMTP_*`, `RECRUITER_SMTP_*`, `BENCHSALES_SMTP_*`, and `AITEAM_SMTP_*`. Email sent by one role uses only that role's configured sender and is not linked to another module's mailbox.
- The navigation label “AI Delivery” is renamed to “AI Team”.

---

## Linked workflow upgrade (2026-07-22)

This release upgrades Europa CRM from name-linked CRUD screens to an additive, relational workflow foundation. Existing display-name columns remain temporarily for backward compatibility, while new automation uses database IDs.

### Important upgrade order

1. Back up PostgreSQL.
2. Copy `backend/.env.example` to `backend/.env` and `frontend/.env.example` to `frontend/.env`.
3. Set a random `JWT_SECRET` of at least 32 characters.
4. Start PostgreSQL: `docker compose up -d postgres`.
5. Generate Prisma Client: `npm run db:generate`.
6. Apply migrations: `npm run db:migrate`.
7. Link safe existing records: `npm run db:link`.
8. Review `backend/prisma/link-exceptions.json`. Ambiguous rows are never silently linked.
9. Seed the administrator and task templates: `npm run db:seed`.
10. Build and run: `npm run build`, then `npm run dev`.

### Windows PowerShell setup

```powershell
Copy-Item backend/.env.example backend/.env
Copy-Item frontend/.env.example frontend/.env
docker compose up -d postgres
npm install
npm run db:generate
npm run db:migrate
npm run db:link
npm run db:seed
npm run build
npm run dev
```

Health check: `http://localhost:4000/api/health`. A healthy response includes `database: "connected"`. A 503 response contains the actionable database error.

### Required environment variables

Backend startup validates `DATABASE_URL`, `JWT_SECRET`, CORS origin and core configuration. Google login requires the same OAuth Web Client ID in `GOOGLE_CLIENT_ID` and `VITE_GOOGLE_CLIENT_ID`.

Each operational role must have its own complete SMTP configuration:

- `SALES_SMTP_HOST`, `SALES_SMTP_PORT`, `SALES_SMTP_USER`, `SALES_SMTP_PASS`, `SALES_SMTP_FROM`
- `RECRUITER_SMTP_HOST`, `RECRUITER_SMTP_PORT`, `RECRUITER_SMTP_USER`, `RECRUITER_SMTP_PASS`, `RECRUITER_SMTP_FROM`
- `BENCHSALES_SMTP_HOST`, `BENCHSALES_SMTP_PORT`, `BENCHSALES_SMTP_USER`, `BENCHSALES_SMTP_PASS`, `BENCHSALES_SMTP_FROM`
- `AITEAM_SMTP_HOST`, `AITEAM_SMTP_PORT`, `AITEAM_SMTP_USER`, `AITEAM_SMTP_PASS`, `AITEAM_SMTP_FROM`

There is deliberately no cross-department SMTP fallback. Missing configuration returns a clear 503 error.

### Implemented workflow endpoints

All endpoints require authentication and backend permission checks.

- `POST /api/workflows/leads/:id/convert` — idempotently creates/links Contact, Account, Opportunity and follow-up Activity.
- `POST /api/workflows/opportunities/:id/close-won` — validates closing details, converts Account lifecycle and creates one AI project with default tasks when delivery type is AI/ML.
- `POST /api/workflows/applications` — creates one CandidateApplication per candidate/job pair.
- `POST /api/workflows/applications/:id/schedule-interview` — schedules a linked interview and moves application/candidate to Interviewing.
- `POST /api/workflows/interviews/:id/select` — requires feedback and creates one active Offer draft.
- `POST /api/workflows/offers/:id/accept` — updates Offer, CandidateApplication, Candidate and Job vacancy count transactionally.
- `POST /api/workflows/candidates/:id/move-to-bench` — creates one Bench profile per Candidate.
- Legacy direct Submission → Placement conversion is disabled. Placements are created only after a selected Interview, Accepted Offer, and confirmed joining; overlapping active placements are rejected.
- `POST /api/workflows/projects/:id/recalculate-progress` — calculates weighted progress and reports whether completion is allowed.
- `GET /api/workflows/notifications` and `POST /api/workflows/notifications/:id/read` — in-app notification API.

### Safe migration behavior

The migration adds nullable relationship IDs first and retains old names. `backend/prisma/link-existing-data.ts` normalizes account names and links only unique exact normalized matches. Unmatched or ambiguous records are written to `backend/prisma/link-exceptions.json` for administrator review.

### Google authentication

Google sign-in does not create CRM users. The verified Google email must exactly match an active Europa CRM user. Inactive or missing users are rejected.

### Backup and rollback

Before migrating:

```powershell
pg_dump -h localhost -p 55432 -U europa -Fc europa_crm -f europa_before_linked_workflows.dump
```

Restore to a new database first when testing rollback:

```powershell
createdb -h localhost -p 55432 -U europa europa_crm_restore
pg_restore -h localhost -p 55432 -U europa -d europa_crm_restore europa_before_linked_workflows.dump
```

### Troubleshooting

- `DATABASE_URL not found`: verify `backend/.env` exists, not only `.env.example`.
- Health returns 503: confirm Docker is running and port `55432` is available.
- Prisma migration conflict: restore the backup or run the migration against a test copy and inspect existing constraints.
- SMTP configuration error: complete the five variables for the logged-in user's department.
- Google login rejected: confirm the OAuth audience and exact active CRM email match.
- Endless loading: the frontend request timeout now returns a Retry action and a readable backend/network error.

### Concise change log

- Added relational IDs and history/audit/notification models.
- Added transactional, idempotent workflow services for Sales, Recruitment, Bench Sales and AI project handoff.
- Added database-aware health check and stricter startup configuration.
- Removed cross-department SMTP fallback.
- Added safe existing-data linking with an exception report.
- Made seed repeatable and added default AI project task templates.
- Preserved current visual theme, existing CRUD fields and role defaults.

### Known limitations

Campaign provider webhooks for delivered/opened/clicked/replied events require provider-specific webhook credentials and public callback URLs; the database models are included but provider integration is not enabled by default. A persistent background-job queue (for example Redis/BullMQ) is not bundled because the current project has no Redis dependency; notification models and due-date workflow foundations are included. Existing ambiguous name-based records require administrator review in the generated exception report.


## Latest UI update (July 22, 2026)

- Login page resized to a balanced medium layout.
- Login illustration moved down; promotional taglines removed.
- Sidebar renamed to **AI TEAM** and **Bench Consultant**.
- Removed PostgreSQL/live-data promotional labels from the user interface.
- Added separate Sales, Recruitment, Bench, and AI mailbox shortcuts under the message icon. These are independent filters and are not externally linked email accounts.
- Removed the calendar icon beside the message icon.
- Increased sidebar logo area and improved text wrapping/overflow protection across cards, bars, tables, and controls.
- Report period and grouping controls refresh automatically when changed.

### Run locally

1. Install Node.js 20+, PostgreSQL, and npm.
2. Copy `backend/.env.example` to `backend/.env` and enter your PostgreSQL `DATABASE_URL` and `JWT_SECRET`.
3. Copy `frontend/.env.example` to `frontend/.env`.
4. From the project root run:

```bash
npm install
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

5. Open the frontend URL printed by Vite (normally `http://localhost:5173`). The API normally runs at `http://localhost:4000`.


## Latest UI and mail updates

- Dashboard cards are display-only; they no longer open modules.
- All module record lists open with the newest records first (`createdAt` descending).
- The login illustration and left panel were reduced and rebalanced.
- Non-editable blank areas use the normal arrow cursor. Only inputs and text areas use the text cursor.
- Separate mail sub-modules are available: **S-mail**, **IT-mail**, **Bench-mail**, and **AI-mail**.
- Each mail page has its own SMTP connection check and compose/send form. IMAP is not required for sending mail.

### Configure department SMTP accounts

Open `backend/.env` and fill the matching variables. For Gmail use `smtp.gmail.com`, port `587`, and a Google App Password (not the normal Gmail password).

```env
SALES_SMTP_HOST=smtp.gmail.com
SALES_SMTP_PORT=587
SALES_SMTP_USER=sales-account@gmail.com
SALES_SMTP_PASS=your_app_password
SALES_SMTP_FROM=Sales Team <sales-account@gmail.com>

RECRUITER_SMTP_HOST=smtp.gmail.com
RECRUITER_SMTP_PORT=587
RECRUITER_SMTP_USER=it-account@gmail.com
RECRUITER_SMTP_PASS=your_app_password
RECRUITER_SMTP_FROM=IT Recruitment <it-account@gmail.com>

BENCHSALES_SMTP_HOST=smtp.gmail.com
BENCHSALES_SMTP_PORT=587
BENCHSALES_SMTP_USER=bench-account@gmail.com
BENCHSALES_SMTP_PASS=your_app_password
BENCHSALES_SMTP_FROM=Bench Team <bench-account@gmail.com>

AITEAM_SMTP_HOST=smtp.gmail.com
AITEAM_SMTP_PORT=587
AITEAM_SMTP_USER=ai-account@gmail.com
AITEAM_SMTP_PASS=your_app_password
AITEAM_SMTP_FROM=AI Team <ai-account@gmail.com>
```

## Personal Mail Groups (2026-07-22)

The existing S-mail, IT-mail, Bench-mail and AI-mail workspaces now support private reusable Mail Groups. Every group is stored against the authenticated user and its mail module, so groups are never shared between users or modules. Group members reference current CRM records; email addresses are resolved when composing, so CRM email changes are automatically reflected.

### Safe database update

This release adds the `MailGroup` and `MailGroupMember` tables through migration `20260722130000_personal_mail_groups`.

Before migrating an existing database, ensure all migrations already recorded in PostgreSQL are also present under `backend/prisma/migrations`. In particular, if your database contains `20260722063201_npm_run_db_seednpm_run_dev`, copy that migration folder from your previous working project into the new project's migration directory. Do not use `prisma migrate reset` on a database containing required CRM data.

Then run from the project root:

```cmd
npm install
copy backend\.env.example backend\.env
copy frontend\.env.example frontend\.env
notepad backend\.env
npm run db:generate
cd backend
npx prisma migrate deploy
cd ..
npm run dev
```

For a local development database whose migration history is already complete, `npm run db:migrate` may be used instead of `npx prisma migrate deploy`.

## One-command deployment preparation

This package includes the complete Prisma migration chain, including the archived
`20260722063201_npm_run_db_seednpm_run_dev` migration entry that was missing from
older ZIP files.

After configuring `backend/.env` and `frontend/.env`, run from the project root:

```cmd
deploy.cmd
```

The script installs locked dependencies, generates Prisma Client, safely reconciles
the exact archived migration entry when an existing database already contains it,
applies pending migrations, and builds the backend and frontend.

It does **not** reset or delete the database. After it completes, start the production
backend with:

```cmd
npm start
```

For local development, use:

```cmd
npm run dev
```

## Compact login and zero-value startup update (2026-07-22)

- The desktop login card, logo, illustration, icons, fields, button, and spacing are now smaller and centered like a regular login page.
- The layout uses a fixed compact maximum width instead of stretching with the browser after refresh.
- Username and password start empty, browser autofill is discouraged, and **Remember me** starts unchecked.
- Dashboard and report values continue to come only from PostgreSQL and show `0` when no business records exist.

To clear existing CRM business/demo records so all dashboard values return to zero, while preserving users and project task templates, run once from the project root:

```cmd
npm run db:reset-business
```

### Run locally on Windows

Open Command Prompt in the extracted project folder and run:

```cmd
npm install
copy backend\.env.example backend\.env
copy frontend\.env.example frontend\.env
notepad backend\.env
npm run db:generate
cd backend
npx prisma migrate deploy
cd ..
npm run db:seed
npm run db:reset-business
npm run dev
```

Set `DATABASE_URL` in `backend\.env` to your PostgreSQL connection before running the migration. Then open the Vite address shown in Command Prompt, normally `http://localhost:5173`.

## Completely fresh CRM — all values zero (2026-07-22 revision)

This package no longer seeds sample leads, contacts, accounts, opportunities, candidates, jobs, consultants, submissions, AI projects, AI tasks, activities, pipeline amounts, or task templates. Only the administrator login is created.

### Recommended Windows method

Double-click or run the following file from Command Prompt:

```cmd
START_FRESH_CRM.cmd
```

The script deliberately removes the old Docker PostgreSQL volume, creates a new database on host port `55432`, applies migrations, creates only the administrator account, clears every remaining CRM data table, and starts the application.

**Warning:** this permanently deletes all records in the existing Europa CRM Docker database.

### Manual method

From the extracted project root:

```cmd
docker compose down -v
docker compose up -d
timeout /t 10
npm install
copy backend\.env.example backend\.env
copy frontend\.env.example frontend\.env
npm run db:generate
cd backend
npx prisma migrate deploy
cd ..
npm run db:seed
npm run db:reset-business
npm run dev
```

The supplied `backend/.env.example` uses:

```env
DATABASE_URL="postgresql://europa:europa_password@localhost:55432/europa_crm?schema=public"
```

Open the Vite address printed in Command Prompt, normally `http://localhost:5173`.

## Clear demo records without deleting the database

To keep the existing Docker PostgreSQL database, administrator/users, login access, settings, and mail groups while clearing only demo/business content, run:

```cmd
CLEAR_DEMO_DATA.cmd
```

Or run manually from the project root:

```cmd
npm install
npm run db:generate
npm run db:reset-business
```

This does **not** run `docker compose down -v` and does not recreate PostgreSQL. It clears CRM business records so dashboard totals return to zero.


## Enterprise Bench Sales Workflow Update (2026-07-23)

The Bench Sales area now uses connected records:

`Bench Consultant -> Submission -> Bench Interview -> Bench Offer -> Placement`

- Consultant data is entered once and selected in Submission.
- Submission data auto-fills Interview and Offer forms.
- An accepted Offer is selected when creating a Placement.
- Offer and Placement remain separate because an offer may be rejected, withdrawn, or expire before joining.
- All calendar controls display and accept `MM/DD/YYYY` while storing an ISO-safe date value.
- Submission, each interview round, offer events, and placement/contract milestones have separate date fields.

Apply the included migration with `npx prisma migrate deploy`; never use `prisma migrate reset` on a database containing required data.


## Login-fixed Windows setup (2026-07-23)

This build repairs the configured administrator account whenever the exact configured admin credentials are used. It also accepts both `localhost:5173` and `127.0.0.1:5173`, and the frontend automatically targets the current browser hostname.

### First run

1. Start Docker Desktop.
2. Double-click `START_EUROPA.cmd`.
3. Open `http://localhost:5173`.
4. Login with `admin` / `admin123` (or the values in `backend/.env`).

### Later runs

Double-click `START_DAILY.cmd`.

Do not run `prisma migrate reset`; it deletes data. Use `npx prisma migrate deploy` instead.

## Bench Sales enterprise workflow update (2026-07-23)

The Bench Sales forms now follow a connected consultant lifecycle:

- Bench Consultant stores the consultant master profile, compliance, availability, rates, ownership and resume information.
- Submission selects a consultant and auto-fills consultant details. It stores only requirement, vendor/client, rate, RTR and submission-stage dates.
- Interview selects a submission and supports separate rounds, schedule, interviewer details, feedback, result and follow-up dates.
- Offer links to a submission and an optional selected interview. It stores offer dates, commercial terms, compliance/onboarding and decision status.
- Placement can select only an Accepted offer. Linked consultant, client, vendor and rate details are auto-filled and read-only.
- Calendar fields display and accept MM/DD/YYYY consistently.
- Linked fields are read-only to reduce duplicate or conflicting entry.
- Placement selection excludes non-accepted offers; selected-interview linking excludes non-selected interviews.

All additional workflow fields are persisted through the existing `customData` support, so no destructive database reset is required.

### Safe Windows run sequence

1. Start Docker Desktop.
2. Run `docker start europa-crm-postgres`.
3. From the project root, run `npm install`.
4. Run `npm run db:generate`.
5. Run `cd backend`, then `npx prisma migrate deploy`.
6. Run `npx prisma db seed` to create or repair the administrator login.
7. Return to the root with `cd ..` and run `npm run dev`.
8. Open `http://localhost:5173`.

Default login: `admin` / `admin123` unless changed in `backend/.env`.

Do not run `prisma migrate reset`; it deletes existing records.

## Bench Sales PRD Alignment and Workflow Automation Update

This build aligns the Bench Sales forms with the supplied Europa Bench Sales PRD and enforces one controlled lifecycle:

`Consultant → Submission → Interview → Offer → Placement`

Key changes:

- Consultant labels standardized to **Technology Name**, **Consultant Relocation**, **Valid Visa**, and **Submission Owner**.
- Consultant IDs are generated by the backend; duplicate email, phone, and LinkedIn checks are enforced.
- Submission fields standardized for Candidate Company, Vendor Email, Implementation Name, End Client, Submission Rate, Work Location, Work Mode, and Submission Owner.
- Interview selections are relation-safe: only submissions belonging to the selected consultant are shown, and only selected interviews belonging to the chosen submission can be attached to offers.
- Changing a Submission to **Interview Scheduled** creates one Interview draft.
- Choosing **Next Round** creates one next-round Interview draft.
- Selecting an Interview creates one Offer draft.
- Accepted Offers use **Confirm Joining & Create Placement**; the old direct Submission-to-Placement shortcut is disabled.
- Placement Pay Rate is removed from UI/API JSON storage. Existing obsolete Placement pay-rate keys are removed by migration.
- Statuses synchronize across Consultant, Submission, Interview, Offer, and Placement records.
- Follow-up, interview, feedback, joining, offer-expiry, compliance-expiry, and contract-end activities are created automatically.
- Required fields and linked-record ownership are validated by the backend, not only by the browser.
- Workflow updates are audited and duplicate submissions, next-stage records, and overlapping active placements are prevented.

After extracting this update, run the normal setup so the data-cleanup migration is applied:

```cmd
npm install
npm run db:generate
cd backend
npx prisma migrate deploy
cd ..
npm run dev
```

The migration preserves existing records and removes only the obsolete `payRate` key from Placement custom data while standardizing `On-site` work-mode values.


## Bench Sales Jobs, Access and Consultant Form Update

This build includes the following Bench Sales corrections:

- Jobs now include a required **Skills Required** field in Add/Edit, search, filters, table, import/export and PostgreSQL storage.
- Saving a Job closes the form and returns to the Jobs records table. Jobs do not use **Save & New**.
- The old filter **Clear** action is replaced by **Apply Filters**. Jobs by Status, Jobs by Type and Quick Filters are displayed above the full-width Jobs table.
- Add-record forms and the login page start empty; no text, select, number, date, username or password value is prefilled.
- Bench Sales role names and permissions are normalized in both frontend and backend. Existing BENCHSALES accounts are restricted to Bench Sales modules, receive Jobs access, and no longer inherit Sales / Marketing access.
- Consultant IDs are generated by the backend. Time Zone is a dropdown. Retired Availability/Marketing fields are removed; only Available From and Notice Period remain, followed by Resume, Submission Owner and Expected Rate/Hour.

Apply the migration and sign out/sign back in so an existing Bench Sales session receives the corrected permissions:

```cmd
npm ci
npm run db:generate
cd backend
npx prisma migrate deploy
cd ..
npm run dev
```

Do not run `prisma migrate reset`; it deletes existing records.

## Bench Sales integrity update — run instructions

After extracting this package, run from the project root:

```cmd
npm install
docker compose up -d
cd backend
npx --no-install prisma generate
npx --no-install prisma migrate deploy
cd ..
npm run dev
```

The database URL in `backend\.env` must use the mapped Docker port:

```env
DATABASE_URL="postgresql://europa:europa_password@localhost:55432/europa_crm?schema=public"
```

This update adds a migration for unique Consultant IDs and decimal-safe Bench experience/rate fields. Existing CRM data is preserved. Do not run `docker compose down -v`.


## Latest compact update
- Jobs filters open from one `Filters` button and are applied only by `Apply Filters`.
- Add User always opens with blank username/password fields; browser autofill is disabled.
- Normal users see only records created by their own login. Super Admin sees all users' records.
- Existing legacy records remain visible to a user when their Owner name matches the login name.
- Consultant ID is generated by the backend and cannot receive keyboard focus.
- Bench Consultant DOB was removed; Highest Qualification includes a conditional Other field.

### Run after updating
```cmd
docker compose up -d
npm install
cd backend
npx --no-install prisma generate
npx --no-install prisma migrate deploy
cd ..
npm run dev
```
Open `http://localhost:5173`.

## July 2026 incremental update: shared Jobs and Resume Parsing

- Jobs remain a shared Bench Sales reference list: every authorized Bench Sales user can view all Jobs.
- Ownership protection remains in place for changes: a normal user can edit or delete only Jobs created by that login; Super Admin can manage all Jobs.
- Bench Consultants remain owner-scoped. Each normal user sees only Consultant and workflow records created by that login; Super Admin sees all records.
- Bench Consultant resume upload now accepts PDF, DOC and DOCX up to 12 MB.
- Uploading a resume stores the original file and automatically extracts text and structured resume data.
- Parsed values populate the existing Consultant form and the existing `skills` field, preserving the current matching engine, filters, reports and API contracts.
- Extracted text, parsed JSON, original filename and parse status are stored inside the existing Bench `customData`; `resumeUrl` continues to use the existing column.
- If parsing fails, the resume remains uploaded and the form can be completed manually.

After extracting the ZIP, run `npm install` so the added resume parsing packages are installed, then run the normal Prisma and application startup commands. No database migration is required for this update.

## Job → Consultant → Submission automation (2026-07-28)

This incremental update keeps the existing matching formula and workflow while connecting the three Bench Sales records reliably:

1. Creating or editing a Job automatically creates/updates its linked Requirement record.
2. Add Submission now requires selecting an existing Bench Consultant and an Open Job.
3. Job, vendor, client, location, work mode, rate type and requirement reference are populated from the selected Job.
4. Consultant contact details, skills, visa, resume and expected rate are populated from the selected Consultant.
5. The existing matching engine calculates and stores `matchPercentage` and `matchDetails` on the Submission.
6. The backend blocks expired/closed Jobs, no-vacancy Jobs, visa/experience mismatches, rates above the Job maximum, and duplicate active submissions.
7. Existing text snapshot fields remain available for reports and backward compatibility; authoritative links are `jobId`, `requirementId`, and `benchConsultantId`.

Apply the included Prisma migration with `npx --no-install prisma migrate deploy` before starting the updated application.


## Bench Sales workflow automation (2026-07-28)

The Bench Sales lifecycle is now connected incrementally without replacing the existing modules or API contracts:

- Resume parsing continues to populate the existing Bench Consultant form and `skills` field.
- Jobs are shared read-only across Bench Sales users; only the creator and Super Admin may modify a Job.
- Saving a Job creates or synchronizes its linked Requirement for the existing matching engine.
- Open Jobs expose a **View Top Consultant Matches** action. Matching is calculated only against consultants visible to the logged-in user, while Super Admin can match all consultants.
- Creating a Submission from a Consultant and Job automatically copies Job, Consultant, Requirement and match details and enforces visa, experience, rate, vacancy, expiry and duplicate rules.
- Submission status **Interview Scheduled** creates an Interview draft. Selecting an Interview creates an Offer draft.
- Accepting a Bench Offer creates one idempotent **Onboarding** Placement, decreases the linked Job's remaining vacancy count, and marks the Job and Requirement **Filled** when no vacancy remains.
- Confirm Joining updates the existing onboarding Placement with actual start and contract information instead of creating a duplicate.
- The Bench scheduler now catches temporary PostgreSQL connection failures so a database outage does not crash the API.

After extracting the ZIP, run `npm install`, `npm run db:generate`, `npm run db:migrate` (or `prisma migrate deploy` for an existing deployment), and then `npm run dev`.


## Inline automation workflow update

See `AUTOMATION_INLINE_WORKFLOW_UPDATE.md` for the consultant-to-job and job-to-consultant inline matching UI, workflow strip across Bench Sales modules, and two-record demonstration seed.

## Fix: Job Rate Type validation

The Add/Edit Job form now includes a required **Rate Type** dropdown under **Commercial Details** with these values: `C2C`, `W2`, and `1099`. New jobs default to `C2C`, including any unfinished browser draft created before this fix. The selected value is sent to the backend, so the job record saves without the hidden “Rate Type is required” error.

## Run on Windows

1. Extract the ZIP to a normal folder (do not run it from inside the ZIP).
2. Start Docker Desktop and wait until it says Docker is running.
3. Double-click `START_EUROPA.cmd`.
4. Wait for the backend and frontend terminal windows to finish starting.
5. Open the URL shown by Vite, normally `http://localhost:5173`.

If this is the first run or dependencies changed, open PowerShell in the project folder and run:

```powershell
npm install
npm run db:generate
npm run build
npm run dev
```

Keep Docker/PostgreSQL running while using the application. If the browser still shows the old form, press `Ctrl+F5` once to force-refresh the frontend.
