-- CreateEnum
CREATE TYPE "SubmissionEmailStatus" AS ENUM ('Draft', 'Sent', 'Failed', 'Opened', 'Replied');

-- AlterTable
ALTER TABLE "BenchInterview" ADD COLUMN     "rejectionReason" TEXT,
ADD COLUMN     "rejectionStage" TEXT,
ADD COLUMN     "result" TEXT NOT NULL DEFAULT 'Pending';

-- CreateTable
CREATE TABLE "SubmissionEmail" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "toEmail" TEXT NOT NULL,
    "ccEmail" TEXT,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "attachments" JSONB,
    "sentBy" TEXT NOT NULL,
    "sentDate" TIMESTAMP(3),
    "status" "SubmissionEmailStatus" NOT NULL DEFAULT 'Draft',
    "messageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubmissionEmail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SubmissionEmail_submissionId_idx" ON "SubmissionEmail"("submissionId");

-- CreateIndex
CREATE INDEX "SubmissionEmail_status_idx" ON "SubmissionEmail"("status");

-- AddForeignKey
ALTER TABLE "SubmissionEmail" ADD CONSTRAINT "SubmissionEmail_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
