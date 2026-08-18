ALTER TABLE "Job"
  ADD COLUMN IF NOT EXISTS "jobReference" TEXT,
  ADD COLUMN IF NOT EXISTS "endClient" TEXT,
  ADD COLUMN IF NOT EXISTS "implementationPartner" TEXT,
  ADD COLUMN IF NOT EXISTS "vendorCompany" TEXT,
  ADD COLUMN IF NOT EXISTS "vendorEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "vendorContact" TEXT,
  ADD COLUMN IF NOT EXISTS "preferredSkills" TEXT,
  ADD COLUMN IF NOT EXISTS "minExperience" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "maxExperience" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "visaRequirements" TEXT,
  ADD COLUMN IF NOT EXISTS "maxRate" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "rateType" TEXT,
  ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS "workMode" TEXT,
  ADD COLUMN IF NOT EXISTS "receivedDate" TEXT,
  ADD COLUMN IF NOT EXISTS "expiryDate" TEXT,
  ADD COLUMN IF NOT EXISTS "jobDescription" TEXT,
  ADD COLUMN IF NOT EXISTS "requirementId" TEXT;

ALTER TABLE "Requirement" ALTER COLUMN "minExperience" TYPE DOUBLE PRECISION USING "minExperience"::DOUBLE PRECISION;
ALTER TABLE "Submission" ADD COLUMN IF NOT EXISTS "jobId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Job_jobReference_key" ON "Job"("jobReference");
CREATE UNIQUE INDEX IF NOT EXISTS "Job_requirementId_key" ON "Job"("requirementId");
CREATE INDEX IF NOT EXISTS "Job_expiryDate_idx" ON "Job"("expiryDate");
CREATE INDEX IF NOT EXISTS "Submission_jobId_idx" ON "Submission"("jobId");
CREATE UNIQUE INDEX IF NOT EXISTS "Submission_benchConsultantId_jobId_vendorCompany_key" ON "Submission"("benchConsultantId", "jobId", "vendorCompany");

DO $$ BEGIN
  ALTER TABLE "Job" ADD CONSTRAINT "Job_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Submission" ADD CONSTRAINT "Submission_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
