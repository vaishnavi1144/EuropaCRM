-- Bench Sales Jobs and role-access correction
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "skillsRequired" TEXT;

-- Normalize older Bench Sales role spellings before applying the correct module access.
UPDATE "User"
SET "role" = 'BENCHSALES'
WHERE UPPER(REGEXP_REPLACE("role", '[^A-Za-z]', '', 'g')) = 'BENCHSALES';

-- Remove stale Sales / Marketing access from Bench Sales users and include Jobs.
UPDATE "User"
SET "permissions" = '[
  "dashboard",
  "jobs",
  "bench",
  "submissions",
  "placements",
  "bench-reports",
  "bench-mail-view",
  "bench-mail-compose",
  "bench-mail-bulk",
  "bench-mail-groups-view",
  "bench-mail-groups-create",
  "bench-mail-groups-edit",
  "bench-mail-groups-delete",
  "settings"
]'::jsonb
WHERE "role" = 'BENCHSALES';


-- Remove retired Consultant Availability / Marketing and unused rate-owner form data.
UPDATE "Bench"
SET "customData" = COALESCE("customData", '{}'::jsonb)
  - ARRAY[
      'availabilityStatus',
      'benchSince',
      'marketingStartDate',
      'marketingEndDate',
      'lastMarketedDate',
      'marketingStatus',
      'rateType',
      'targetRate',
      'minimumRate',
      'recruiterName',
      'managerName'
    ];
