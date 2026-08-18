-- Bench integrity and decimal-safe commercial fields
ALTER TABLE "Bench" ADD COLUMN IF NOT EXISTS "consultantCode" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Bench_consultantCode_key" ON "Bench"("consultantCode");
ALTER TABLE "Bench" ALTER COLUMN "experienceYears" TYPE DOUBLE PRECISION USING "experienceYears"::double precision;
ALTER TABLE "Bench" ALTER COLUMN "ratePerHour" TYPE DOUBLE PRECISION USING "ratePerHour"::double precision;
ALTER TABLE "Requirement" ALTER COLUMN "maxRate" TYPE DOUBLE PRECISION USING "maxRate"::double precision;
ALTER TABLE "Submission" ALTER COLUMN "ratePerHour" TYPE DOUBLE PRECISION USING "ratePerHour"::double precision;
ALTER TABLE "BenchInterview" ALTER COLUMN "submissionRate" TYPE DOUBLE PRECISION USING "submissionRate"::double precision;
ALTER TABLE "BenchOffer" ALTER COLUMN "billRate" TYPE DOUBLE PRECISION USING "billRate"::double precision;
ALTER TABLE "BenchOffer" ALTER COLUMN "payRate" TYPE DOUBLE PRECISION USING "payRate"::double precision;
ALTER TABLE "Placement" ALTER COLUMN "billingRate" TYPE DOUBLE PRECISION USING "billingRate"::double precision;
