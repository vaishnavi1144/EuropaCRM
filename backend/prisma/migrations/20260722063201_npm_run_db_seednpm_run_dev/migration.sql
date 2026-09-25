-- Baseline compatibility migration.
--
-- This migration name was created and applied by an earlier development build,
-- but its generated file was not included in that build's deployment archive.
-- The actual additive schema changes are preserved in the later idempotent
-- migration 20260722090000_linked_workflows.
--
-- Keeping this no-op migration in the chain allows both fresh databases and
-- existing databases to share one complete, deployment-safe migration history.
SELECT 1;
