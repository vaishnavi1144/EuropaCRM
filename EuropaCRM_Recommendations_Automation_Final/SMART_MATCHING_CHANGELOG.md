# Smart Matching Update

## Implemented

- Consultant-to-Job recommendations for every active Bench Consultant.
- Existing Job-to-Consultant recommendations retained.
- One shared explainable matching service is used in both directions.
- Separate scores for technical skills, experience, domain, location, visa, rate, availability, and work mode.
- Skill aliases/equivalents for common technology names.
- Strong Match, Good Match, Review Recommended, Possible Match, and Low Match categories.
- Missing Job data is marked Not Evaluated rather than treated as a failed match.
- Underqualified and overqualified candidates receive warnings, not automatic rejection.
- Manual recruiter override with a required business reason for low/risky matches.
- Override reason, strengths, warnings, match category, and full score breakdown stored with the Submission.
- Active duplicate submissions, unavailable consultants, missing resumes, expired/closed Jobs, and zero vacancies remain protected.

## Files modified

- `backend/src/lib/matching.ts`
- `backend/src/routes/workflows.ts`
- `frontend/src/pages/ModulePage.tsx`
- `ENTERPRISE_BENCH_AUTOMATION_REPORT.md`

## API changes

- Added `POST /api/workflows/bench/:benchId/recommended-jobs`
- Enhanced `POST /api/workflows/jobs/:jobId/submit/:benchId` with `overrideReason`

## Database changes

No database migration and no duplicate tables. Existing JSON columns store match explanations and override details.

## Verification

- ZIP structure verified.
- Modified TypeScript source was inspected for route/action integration.
- A complete dependency build could not be performed in this sandbox because `npm ci` timed out and package dependencies were unavailable. Run `npm install`, `npm run db:generate`, and `npm run build` on the target machine before production deployment.
