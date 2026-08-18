# Visible Matching Automation Update

## Problem corrected
The smart matching APIs existed, but the Jobs and Bench Consultants list pages did not expose them as visible row actions. Matching could only be reached indirectly from the read-only details dialog, so users reasonably believed automation was missing.

## UI changes
- Added a visible green sparkle action to every Job row: **Recommended Consultants**.
- Added a visible green sparkle action to every Bench Consultant row: **Recommended Jobs**.
- Added an automation information banner on both pages.
- Added a full match-results dialog instead of browser prompt-only output.
- The dialog displays overall percentage, category, technical/experience/domain/visa/location/rate/availability/certification scores, matched skills, missing skills, strengths, warnings and hard blockers.
- Added Resume access for consultant results.
- Added **Submit Resume** and **Submit Anyway** actions.

## Workflow integration
Both directions reuse the existing workflow endpoints and matching service:
- `POST /api/workflows/jobs/:jobId/top-matches`
- `POST /api/workflows/bench/:benchId/recommended-jobs`
- `POST /api/workflows/jobs/:jobId/submit/:benchId`

One-click submission continues to create the Submission, update Consultant status, create Activity, Notification and Audit Log inside the existing transaction.

## Files modified
- `frontend/src/pages/ModulePage.tsx`
- `frontend/src/components/crm/DataTable.tsx`
- `frontend/src/components/crm/MatchResultsDialog.tsx` (new)

## Database changes
None.

## Build note
A complete dependency build could not be run in the isolated environment because package installation timed out. The source ZIP contains no `node_modules`; run `npm install`, `npm run db:generate`, and `npm run build` in the deployment environment.
