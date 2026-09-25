-- Enterprise Bench Sales workflow: separate interviews, offers and placements.
CREATE TABLE "BenchInterview" (
  "id" TEXT NOT NULL,
  "candidateName" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "benchConsultantId" TEXT NOT NULL,
  "clientCompany" TEXT,
  "vendorCompany" TEXT,
  "jobTitle" TEXT NOT NULL,
  "interviewRound" TEXT NOT NULL DEFAULT 'Round 1',
  "interviewDate" TEXT,
  "interviewTime" TEXT,
  "timeZone" TEXT,
  "interviewMode" TEXT,
  "meetingLink" TEXT,
  "interviewer" TEXT,
  "status" TEXT NOT NULL DEFAULT 'Scheduled',
  "feedbackDate" TEXT,
  "feedback" TEXT,
  "ownerName" TEXT NOT NULL,
  "customData" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BenchInterview_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "BenchOffer" (
  "id" TEXT NOT NULL,
  "candidateName" TEXT NOT NULL,
  "submissionId" TEXT NOT NULL,
  "benchConsultantId" TEXT NOT NULL,
  "benchInterviewId" TEXT,
  "clientCompany" TEXT NOT NULL,
  "vendorCompany" TEXT,
  "jobTitle" TEXT NOT NULL,
  "offerDate" TEXT,
  "offerReceivedDate" TEXT,
  "offerAcceptedDate" TEXT,
  "offerRejectedDate" TEXT,
  "offerExpiryDate" TEXT,
  "expectedJoiningDate" TEXT,
  "billRate" INTEGER NOT NULL DEFAULT 0,
  "payRate" INTEGER NOT NULL DEFAULT 0,
  "rateType" TEXT NOT NULL DEFAULT 'C2C',
  "workLocation" TEXT,
  "contractDuration" TEXT,
  "status" TEXT NOT NULL DEFAULT 'Pending',
  "decisionReason" TEXT,
  "ownerName" TEXT NOT NULL,
  "customData" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BenchOffer_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Placement" ADD COLUMN "benchOfferId" TEXT;
CREATE UNIQUE INDEX "Placement_benchOfferId_key" ON "Placement"("benchOfferId");
CREATE INDEX "BenchInterview_candidateName_idx" ON "BenchInterview"("candidateName");
CREATE INDEX "BenchInterview_submissionId_idx" ON "BenchInterview"("submissionId");
CREATE INDEX "BenchInterview_benchConsultantId_idx" ON "BenchInterview"("benchConsultantId");
CREATE INDEX "BenchInterview_interviewDate_idx" ON "BenchInterview"("interviewDate");
CREATE INDEX "BenchInterview_status_idx" ON "BenchInterview"("status");
CREATE INDEX "BenchOffer_candidateName_idx" ON "BenchOffer"("candidateName");
CREATE INDEX "BenchOffer_submissionId_idx" ON "BenchOffer"("submissionId");
CREATE INDEX "BenchOffer_benchConsultantId_idx" ON "BenchOffer"("benchConsultantId");
CREATE INDEX "BenchOffer_offerDate_idx" ON "BenchOffer"("offerDate");
CREATE INDEX "BenchOffer_status_idx" ON "BenchOffer"("status");
ALTER TABLE "BenchInterview" ADD CONSTRAINT "BenchInterview_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BenchInterview" ADD CONSTRAINT "BenchInterview_benchConsultantId_fkey" FOREIGN KEY ("benchConsultantId") REFERENCES "Bench"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BenchOffer" ADD CONSTRAINT "BenchOffer_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BenchOffer" ADD CONSTRAINT "BenchOffer_benchConsultantId_fkey" FOREIGN KEY ("benchConsultantId") REFERENCES "Bench"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BenchOffer" ADD CONSTRAINT "BenchOffer_benchInterviewId_fkey" FOREIGN KEY ("benchInterviewId") REFERENCES "BenchInterview"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Placement" ADD CONSTRAINT "Placement_benchOfferId_fkey" FOREIGN KEY ("benchOfferId") REFERENCES "BenchOffer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
