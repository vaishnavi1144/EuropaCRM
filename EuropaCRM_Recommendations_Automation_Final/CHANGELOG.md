
## 2026-07-28 - Complete Bench Sales lifecycle automation
- Added owner-aware top consultant matching from each shared Job.
- Added automatic onboarding Placement creation after Bench Offer acceptance.
- Added idempotent Confirm Joining updates for the existing Placement.
- Added automatic Job vacancy decrement and Filled status synchronization.
- Added audit logging for Job matching runs.
- Hardened the Bench scheduler against temporary database connectivity failures.

## 2026-07-28 – compact fixes
- Jobs filters are collapsed into one filter bar and only apply after clicking Apply Filters.
- Consultant ID is non-focusable/read-only and DOB was removed from Bench Consultant.
- Highest Qualification uses a controlled list with conditional Other Qualification entry.
- Add User credentials open empty and browser autofill is disabled.
- Record visibility is owner-based across modules; Super Admin sees all records.
- Socket updates reload through the authorized API to prevent cross-user rows appearing.

## 2026-07-28 — Bench Sales integrity update

- Protected Interview selection and Offer acceptance behind workflow actions.
- Completed Candidate → Move to Bench field mapping and valid visa enforcement.
- Added database-unique Consultant ID and decimal-safe experience/rates.
- Added linked-record validation, owner-based Bench Sales visibility, and safe bulk-delete restrictions.
- Added hourly background processing for offer expiry and due Bench reminders.
- Changed backend string filters to contains matching and prevented HR Next Round loops.
- Removed Selected/Accepted from normal edit dropdowns.

# Europa CRM Change Log

## Linked workflow upgrade

- Added relational identifiers across Sales, Recruitment, Bench Sales and AI Team records while retaining legacy display-name fields for compatibility.
- Added CandidateApplication, Requirement, status history, OfferRevision, CampaignMember, EmailEvent, ProjectResource, Notification and AuditLog models.
- Added idempotent Prisma-transaction workflows for lead conversion, closed-won handoff, interview/offer progression, offer acceptance, move-to-bench, submission-to-placement and AI project progress.
- Added transparent Bench requirement matching and resource capacity validation.
- Added database-aware health endpoint and actionable startup/network errors.
- Enforced strict department SMTP isolation with no cross-role fallback.
- Added safe existing-data linking and JSON exception report generation.
- Updated the existing README and setup scripts.

## Verification note

Source-level validation and configuration review were completed. Dependency installation and production builds could not be executed in the artifact environment because the package registry was unavailable; run `npm ci`, `npm run db:generate`, `npm run build`, and `npm test` in the target environment before deployment.

## 2026-07-22 — Personal Mail Groups
- Extended the existing module mail workspaces with private reusable recipient groups.
- Added owner- and module-isolated MailGroup/MailGroupMember models and migration.
- Added CRM entity recipient search and current-email resolution.
- Added group create, view, edit, rename, delete, duplicate and member management.
- Added granular view/compose/bulk/group permissions for every mail module.
- Preserved the existing SMTP transport and authenticated `/api/email` architecture.

## 2026-07-22 - Compact login and clean-data utility
- Reduced the complete desktop login card, branding panel, illustration, icons, form controls, and mobile logo.
- Prevented the login layout from expanding to near full-screen size after refresh.
- Login fields now start empty, Remember me starts unchecked, and browser autofill is discouraged.
- Added `npm run db:reset-business` to clear business records and return dashboard/report totals to zero while preserving users and project task templates.


## 2026-07-23 - Enterprise Bench Sales Workflow
- Expanded Bench Consultant master fields for personal, professional, compliance, availability, marketing, rates, ownership, resume, and notes.
- Added linked CRM record selectors with automatic field population.
- Added separate Bench Interviews and Bench Offers modules.
- Kept Offer and Placement as distinct, connected lifecycle stages.
- Added dedicated dates for submissions, interview rounds, offer decisions, joining, contract, project, and extensions.
- Added MM/DD/YYYY calendar entry UI.
- Added Prisma migration `20260723100000_enterprise_bench_sales_workflow`.

## 2026-07-27 — Bench Sales PRD Workflow Automation

- Aligned Consultant, Submission, Interview, and Placement labels/options with the Bench Sales PRD.
- Added backend validation, duplicate detection, backend Consultant IDs, relation integrity, audit logs, and workflow reminders.
- Added automatic Submission → Interview draft, Interview Next Round → next Interview, and Selected Interview → Offer draft transitions.
- Added Accepted Offer → Confirm Joining → Placement workflow.
- Disabled legacy direct Submission → Placement conversion.
- Removed obsolete Placement Pay Rate data and standardized On-site work mode.
- Updated Bench reports to include Interviews and Accepted Offers.


## 2026-07-27 — Bench Sales Jobs, Permissions and Consultant Cleanup

- Added required Skills Required support to Jobs across UI, API, PostgreSQL, filters, records and exports.
- Saving a Job now closes Add Job and returns to its records table.
- Replaced filter Clear with Apply Filters and moved Jobs status/type/quick insights above a full-width table.
- Prevented default Add-form and login values from being submitted.
- Corrected BENCHSALES role normalization, removed stale Sales/Marketing access and added Jobs access for user-based logins.
- Kept backend-generated Consultant IDs; added Time Zone and Notice Period options.
- Removed retired Consultant Availability/Marketing and unused rate/owner fields, retaining Available From, Notice Period, Resume, Submission Owner and Expected Rate/Hour.
- Added migration `20260727180000_bench_jobs_access_and_skills`.

## 2026-07-28 — Shared Jobs and Resume Parsing
- Made Jobs visible to all authorized Bench Sales users while retaining creator/admin edit and delete ownership.
- Added PDF, DOC and DOCX resume extraction for Bench Consultants.
- Added automatic Consultant form population and system-generated matching-engine-compatible skills.
- Reused `resumeUrl` and Bench `customData`; no duplicate tables or API contract changes.

## 2026-07-28 Enterprise Bench Automation
- Shared active Jobs, recruiter-owned downstream workflow, organization-wide recommendations, transactional one-click submission, protected resume parsing merge, USD formatting, validation, and dashboard counters.

## Visible matching automation
- Exposed Job → Recommended Consultants as a visible row action.
- Exposed Consultant → Recommended Jobs as a visible row action.
- Added a connected match results dialog with score breakdown, strengths, gaps, resume access and one-click submission.

## Functional automation presentation update
- Removed decorative workflow and matching explanation banners.
- Moved insight cards above records for a full-width table layout.
- Preserved live Job ↔ Consultant matching and one-click submission actions.
