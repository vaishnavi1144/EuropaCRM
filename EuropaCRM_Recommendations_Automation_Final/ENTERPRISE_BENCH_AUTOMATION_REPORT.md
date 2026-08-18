# Enterprise Bench Sales Automation – Incremental Update

## Files Modified
- `backend/src/routes/crud.ts`
- `backend/src/routes/workflows.ts`
- `backend/src/routes/reports.ts`
- `frontend/src/pages/ModulePage.tsx`
- `frontend/src/components/crm/RecordDialog.tsx`
- `frontend/src/pages/Dashboard.tsx`
- `frontend/src/pages/Reports.tsx`
- `frontend/src/lib/utils.ts`

## Database Changes
No new tables and no destructive migration. Existing Job, Requirement, Bench, Submission, BenchInterview, BenchOffer, Placement, Activity, Notification, and AuditLog models are reused.

## API Changes
Added one backward-compatible workflow endpoint:
`POST /api/workflows/jobs/:jobId/submit/:benchId`

The endpoint creates a Submission, updates the Consultant, creates an Activity, creates a Notification, and writes an AuditLog in one transaction.

## Workflow Changes
- Active Jobs are organization-wide.
- Manager/Admin/Super Admin can access owned workflow records across users; normal users remain creator-scoped.
- Job recommendations compare all Active/Available Bench Consultants.
- Recommended Consultants are sorted by the existing matching service.
- One-click submission prevents duplicates and validates job status, expiry, vacancy, consultant status, and maximum rate.
- Existing Interview → Offer → Placement automation remains intact.

## UI Changes
- Job Details action is now `Recommended Consultants`.
- Recruiter can select a recommended Consultant and submit the resume directly.
- Resume parsing fills only empty fields.
- Conflicting extracted values are shown beside existing values with `Use Existing` and `Use Extracted` actions.
- Required fields display a consolidated validation message.
- Currency displays use USD `$` formatting while numeric database storage is preserved.
- Existing dashboard design is retained with incremental Bench Interview, Offer, and Placement counters.

## Testing Performed
- ZIP structure validation.
- Prisma schema validation by inspection; no schema migration required.
- Static route and endpoint linkage checks.
- Ownership and shared Job query checks.
- One-click transaction path review.
- Resume conflict merge path review.
- TypeScript source syntax inspection.

A full database integration test requires a running PostgreSQL instance and installed npm dependencies.

## Production Readiness Score
**8.4/10**

Before production deployment, run Prisma generation, migrations, TypeScript builds, and end-to-end tests against a staging copy of PostgreSQL.

## 2026 Smart Two-Way Matching Enhancement

This release adds Consultant → Recommended Jobs while preserving Job → Recommended Consultants and reusing one matching service.

### Matching behavior
- Compares required and preferred skills, including common equivalent skill names.
- Separately explains technical, experience, domain, location, visa, rate, availability, and work-mode scores.
- Missing Job data is shown as **Not evaluated** and does not silently reduce the score.
- Match categories: Strong Match, Good Match, Review Recommended, Possible Match, and Low Match.
- Underqualified and overqualified consultants are not automatically rejected.
- Low scores, visa differences, and rate differences are recruiter-review warnings rather than automatic rejection.
- Only genuine operational blockers (for example, no resume or unavailable status) prevent one-click submission.

### Recruiter judgment and override
- Both matching directions display strengths, gaps, warnings, and blockers.
- Recruiters may submit a review-required match by entering a business justification.
- The override reason, category, strengths, and warnings are stored with the Submission and Audit Log.
- Duplicate active submissions, closed/expired Jobs, and Jobs without vacancies remain blocked.

### New API
- `POST /api/workflows/bench/:benchId/recommended-jobs`

### Updated API
- `POST /api/workflows/jobs/:jobId/submit/:benchId` accepts optional `overrideReason`.

### Database
No new table or migration is required. Explainable match details and override metadata reuse the existing JSON fields on Submission and Audit Log.
