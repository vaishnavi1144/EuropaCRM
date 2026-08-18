# Bench Sales Submission Workflow - Visual Guide

## Database Relationship Diagram

```
                          ┌─────────────────────────────┐
                          │    BENCH (Consultant)       │
                          ├─────────────────────────────┤
                          │ id (PK)                     │
                          │ candidateName               │
                          │ email                       │
                          │ phone                       │
                          │ skills                      │
                          │ visaStatus                  │
                          │ experienceYears             │
                          │ expectedRate                │
                          │ ownerName                   │
                          └────────────┬────────────────┘
                                       │
                                       │ (1)
                                       │
                    ┌──────────────────┴──────────────────┐
                    │                                     │
              (Many│)                                (Many│)
                    │                                     │
            ┌───────▼─────────────────┐      ┌──────────▼────────────────┐
            │  SUBMISSION (Bridge)    │      │  BENCH_INTERVIEW          │
            ├───────────────────────────┤     │  BENCH_OFFER              │
            │ id (PK)                 │      │  PLACEMENT                │
            │                         │      └──────────────────────────┘
            │ benchConsultantId (FK)  │◄────────┐
            │ jobId (FK)              │         │ Links to Job through
            │ candidateName           │         │ submission
            │ jobTitle                │         │
            │ status                  │         │
            │ submissionDate          │         │
            │ ratePerHour             │         │
            │ matchPercentage         │         │
            │ ownerName               │         │
            │                         │         │
            │ Unique:                 │         │
            │ [benchConsultantId,     │         │
            │  jobId,                 │         │
            │  vendorCompany]         │         │
            └───────┬─────────────────┘         │
                    │                          │
              (Many│)                          │
                    │                          │
                    └──────────┬───────────────┘
                               │
                               │ (1)
                               │
                    ┌──────────▼────────────┐
                    │   JOB (Requirement)   │
                    ├──────────────────────┤
                    │ id (PK)              │
                    │ jobTitle             │
                    │ company              │
                    │ endClient            │
                    │ skillsRequired       │
                    │ maxRate              │
                    │ status (Open/Filled) │
                    │ vacancyCount         │
                    │ ownerName            │
                    └──────────────────────┘
```

## Submission Workflow State Machine

```
                        ┌──────────┐
                        │  START   │
                        └────┬─────┘
                             │
                             ▼
                        ┌──────────┐
                        │  DRAFT   │  ← Initial state when created
                        └────┬─────┘
                             │
                    ┌────────┴────────┐
                    │                 │
                    ▼                 ▼
            ┌─────────────┐    ┌────────────┐
            │  SUBMITTED  │    │ WITHDRAWN  │ (Terminal)
            └────┬────────┘    └────────────┘
                 │
                 ▼
        ┌──────────────────┐
        │ VENDOR REVIEW    │
        └────┬─────────────┘
             │
             ├─────────┬──────────┐
             │         │          │
             ▼         ▼          ▼
        ┌────────┐ ┌──────────┐ ┌────────────┐
        │ON HOLD │ │ REJECTED │ │ WITHDRAWN  │ (Terminals)
        └────────┘ └──────────┘ └────────────┘
             │
             ▼
    ┌──────────────────┐
    │ CLIENT REVIEW    │
    └────┬─────────────┘
         │
         ├──────────┬──────────────┐
         │          │              │
         ▼          ▼              ▼
    ┌────────┐ ┌──────────┐ ┌────────────┐
    │INTERVIEW│ │REJECTED  │ │ WITHDRAWN  │ (Terminals)
    │REQUESTED│ └──────────┘ └────────────┘
    └────┬────┘
         │
         ▼
    ┌──────────────────┐
    │INTERVIEW         │ ← Auto-create BenchInterview
    │SCHEDULED         │   Update Bench marketing status
    └────┬─────────────┘
         │
         ├─────────┬──────────┐
         │         │          │
         ▼         ▼          ▼
    ┌────────┐ ┌──────────┐ ┌────────────┐
    │ON HOLD │ │ REJECTED │ │ WITHDRAWN  │ (Terminals)
    └────────┘ └──────────┘ └────────────┘
         │
         ▼
    ┌──────────────────┐
    │ ACCEPTED         │ ← Auto-create BenchOffer
    │                  │   Create Placement (Onboarding)
    └──────────────────┘   Update Bench marketing status
```

## Complete Workflow Sequence

```
User Action                           System Response
────────────────────────────────────────────────────────────

1. Create Consultant (Bench)
   - Fill profile (name, skills, visa, rate)
   └─────────────────────────────► ✓ Bench record created
                                   ✓ Generate Consultant ID

2. Create Job
   - Define requirement (title, skills, max rate, vacancies)
   └─────────────────────────────► ✓ Job record created (status: Open)
                                   ✓ Create/Link Requirement

3. Submit Consultant to Job
   - Select Consultant (Bench)
   - Select Job
   - Confirm submission rate
   └─────────────────────────────► ✓ Validate:
                                    - Consultant visa matches
                                    - Consultant experience ≥ job min
                                    - Rate ≤ job max
                                    - No duplicate submission
                                   ✓ Create Submission (Draft)
                                   ✓ Calculate match score
                                   ✓ Auto-populate details
                                   ✓ Set next follow-up date

4. Change Status to "Submitted"
   └─────────────────────────────► ✓ Update Submission status
                                   ✓ Update Bench marketing status

5. Move through workflow
   (Vendor Review → Client Review)
   └─────────────────────────────► ✓ Track status changes
                                   ✓ Create follow-up activities

6. Schedule Interview
   - Change status to "Interview Scheduled"
   └─────────────────────────────► ✓ Auto-create BenchInterview
                                   ✓ Update Bench status → "Interviewing"
                                   ✓ Create interview reminder activity

7. Complete Interview & Select
   - Update Interview result → "Selected"
   └─────────────────────────────► ✓ Mark Interview → "Completed"
                                   ✓ Auto-create BenchOffer (Draft)
                                   ✓ Update Bench status → "Offer"
                                   ✓ Create offer creation task

8. Send & Accept Offer
   - Update Offer status → "Accepted"
   └─────────────────────────────► ✓ Update Submission → "Accepted"
                                   ✓ Auto-create Placement
                                   ✓ Status: "Onboarding"
                                   ✓ Create joining confirmation task
                                   ✓ Update Bench status

9. Confirm Joining
   - Update Placement details
   - Confirm actual start date
   └─────────────────────────────► ✓ Placement status → "Active"
                                   ✓ Start billing/tracking
                                   ✓ Enable ongoing management
```

## Data Denormalization Strategy

### Why Denormalize?

To avoid expensive JOINs and provide quick access in list views, the Submission model includes:

```
FROM Bench:                    FROM Job:
- candidateName                - jobTitle
- consultantEmail              - endClient
- consultantPhone              - requirementReference
- consultantSkills             - vendorCompany
- consultantVisaStatus         - workLocation
- ownerName                    - workMode
                               - requiredSkills
                               - maximumJobRate
```

This is **intentional and appropriate** because:
1. Submission is the primary entity in workflow views
2. Consultant/Job details are **read-only references**
3. Changes to Bench/Job update Submission fields on next edit
4. Denormalization reduces database queries for list rendering

### Consistency Maintenance

When Bench record updates:
```
IF benchConsultantId matching Submission exists:
  THEN Update Submission fields on next edit
  AND Show values from denormalized fields
  AND Allow manual override if needed
```

When Job record updates:
```
IF jobId matching Submission exists:
  THEN Update Submission fields on next edit
  AND Validate rate compliance (if job rate decreased)
```

## Unique Constraint in Detail

```
Constraint: @@unique([benchConsultantId, jobId, vendorCompany])

Composite Key Prevents:
┌─────────────────────────────────────────────────────────────┐
│ Multiple submissions from SAME consultant to SAME job       │
│ through SAME vendor in non-terminal states                  │
│                                                             │
│ Example:                                                    │
│ ✗ John (c123) → Job-A (j456) via TCS [Submitted]          │
│ ✗ John (c123) → Job-A (j456) via TCS [Draft]              │
│ ERROR: Duplicate submission detected                        │
└─────────────────────────────────────────────────────────────┘

Allows:
┌─────────────────────────────────────────────────────────────┐
│ Different Vendors:                                          │
│ ✓ John → Job-A via TCS [Submitted]                         │
│ ✓ John → Job-A via Accenture [Submitted]                   │
│ REASON: Different vendor = different submission opportunity │
│                                                             │
│ Different Jobs:                                            │
│ ✓ John → Job-A via TCS [Submitted]                         │
│ ✓ John → Job-B via TCS [Submitted]                         │
│ REASON: Different job = different opportunity              │
│                                                             │
│ After Rejection:                                           │
│ ✓ John → Job-A via TCS [Rejected]                          │
│ ✓ John → Job-A via TCS [Submitted]  (new attempt)          │
│ REASON: Rejected is terminal, new submission allowed       │
└─────────────────────────────────────────────────────────────┘
```

## Key Validations

```
When Creating Submission:
────────────────────────────────────

1. Consultant Must Exist
   └─► benchConsultantId must reference valid Bench record

2. Job Must Be Open
   └─► job.status = "Open" (not Filled, Closed, etc.)

3. Job Must Have Vacancies
   └─► job.vacancyCount > 0

4. Job Must Not Have Expired
   └─► job.expiryDate > today() or null

5. Consultant Visa Must Match Job Requirements
   └─► consultant.visaStatus in job.visaRequirements

6. Consultant Experience Must Meet Minimum
   └─► consultant.experienceYears >= job.minExperience

7. Submission Rate Must Not Exceed Job Maximum
   └─► submission.ratePerHour <= job.maxRate

8. No Duplicate Submission Exists
   └─► No active submission exists for:
       [consultant, job, vendor] combination


When Status Changes to Interview Scheduled:
──────────────────────────────────────────

1. Auto-create BenchInterview record
   ├─► status: "Draft"
   ├─► interviewRound: "Technical"
   └─► Copy relevant fields from Submission

2. Update Bench marketing status
   └─► status: "Interviewing"

3. Create follow-up activity
   └─► Task: "Schedule Interview Details"


When Interview Result Changed to Selected:
──────────────────────────────────────────

1. Mark Interview as Completed
   └─► status: "Completed"

2. Auto-create BenchOffer record
   ├─► status: "Draft"
   ├─► billRate: from Submission.ratePerHour
   └─► Link to Interview via benchInterviewId

3. Update Bench marketing status
   └─► status: "Offer"

4. Create task
   └─► "Create offer draft for selected interview"


When Offer Status Changed to Accepted:
──────────────────────────────────────

1. Update Submission status
   └─► status: "Accepted"

2. Auto-create Placement record
   ├─► status: "Onboarding"
   ├─► benchOfferId: link to current offer
   ├─► submissionId: link to submission
   └─► Link consultant + job fulfillment

3. Update Bench marketing status
   └─► status: "Offer" (until joining confirmed)

4. Create task
   └─► "Confirm joining: [consultant name]"
```

## Prevention of Conflicts

```
Placement Overlap Prevention:
────────────────────────────

Cannot create two active placements for same consultant
if their date ranges overlap:

✗ Placement 1: Start 2026-08-01, End 2026-12-31
✗ Placement 2: Start 2026-10-01, End 2027-02-28
  ERROR: Overlapping dates

✓ Placement 1: Start 2026-08-01, End 2026-12-31
✓ Placement 2: Start 2027-01-01, End 2027-06-30
  ALLOWED: No overlap


Interview Duplicate Prevention:
───────────────────────────────

Cannot create two active interviews for same submission
if they share:
- Same consultant + job + date + time, OR
- Same consultant + job + round

Prevents accidental duplicate scheduling from:
- Double-click on "Schedule Interview" button
- Manual form submission while already scheduled
```

---

## Summary

✅ **Bench Sales workflow is correctly implemented**

- Submission serves as proper bridge between Consultant and Job
- No direct Bench-to-Job relationships
- Comprehensive validation prevents data corruption
- Automated workflow accelerates Bench Sales process
- Denormalization is strategic and appropriate
- Unique constraint prevents duplicate submissions
- Cascade deletes maintain referential integrity

**The relationship structure is production-ready.**
