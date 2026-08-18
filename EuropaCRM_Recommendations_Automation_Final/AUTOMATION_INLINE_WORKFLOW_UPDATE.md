# Inline Bench Sales Automation Update

## Visible UI changes

- Jobs and Bench Consultants now open matching results directly below the main table, matching the supplied reference layout.
- The inline recommendation table shows match percentage, category, matched skills, missing skills, technical/experience breakdown, rate, location, client/vendor and submission actions.
- `Submit Resume` is shown for normal recommendations.
- `Submit Anyway` requests and stores a recruiter justification for review-required matches.
- The same matching service is reused in both directions:
  - Job → Recommended Consultants
  - Consultant → Recommended Jobs
- An End-to-End Automation strip is shown on Jobs, Bench Consultants, Submissions, Interviews, Offers and Placements so the connected workflow is visible in every Bench Sales module.

## Demonstration data

Running `START_EUROPA.cmd` or `npm run db:seed` adds only a small idempotent demo set:

- 2 Jobs
- 2 Bench Consultants
- 1 linked workflow example across Submission, Interview, Offer and Placement

The demo records are safe to delete. Running the seed again does not duplicate them.

## Existing automation preserved

One-click submission continues to run in a database transaction and links Job, Requirement and Consultant, stores match details, updates statuses, creates activity/audit/notification records and refreshes modules through Socket.IO events.

## Run

```cmd
START_EUROPA.cmd
```

Or manually:

```cmd
npm install
npm run db:generate
cd backend
npx prisma migrate deploy
npx prisma db seed
cd ..
npm run dev
```
