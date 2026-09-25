-- Remove the obsolete Placement pay-rate key while preserving all other placement data.
UPDATE "Placement"
SET "customData" = "customData" - 'payRate'
WHERE "customData" IS NOT NULL AND "customData" ? 'payRate';

-- Standardize PRD work-mode labels in JSON-backed workflow fields.
UPDATE "Submission"
SET "customData" = jsonb_set("customData", '{workMode}', '"On-site"', false)
WHERE "customData"->>'workMode' IN ('Onsite', 'On Site', 'On-site');

UPDATE "BenchInterview"
SET "customData" = jsonb_set("customData", '{workMode}', '"On-site"', false)
WHERE "customData"->>'workMode' IN ('Onsite', 'On Site', 'On-site');

UPDATE "BenchOffer"
SET "customData" = jsonb_set("customData", '{workMode}', '"On-site"', false)
WHERE "customData"->>'workMode' IN ('Onsite', 'On Site', 'On-site');

UPDATE "Placement"
SET "customData" = jsonb_set("customData", '{workMode}', '"On-site"', false)
WHERE "customData"->>'workMode' IN ('Onsite', 'On Site', 'On-site');
