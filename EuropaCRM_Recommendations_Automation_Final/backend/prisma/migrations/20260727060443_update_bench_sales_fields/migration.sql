-- DropForeignKey
ALTER TABLE "Account" DROP CONSTRAINT "Account_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "Account" DROP CONSTRAINT "Account_primaryContactId_fkey";

-- DropForeignKey
ALTER TABLE "Activity" DROP CONSTRAINT "Activity_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "AiProject" DROP CONSTRAINT "AiProject_accountId_fkey";

-- DropForeignKey
ALTER TABLE "AiProject" DROP CONSTRAINT "AiProject_contactId_fkey";

-- DropForeignKey
ALTER TABLE "AiProject" DROP CONSTRAINT "AiProject_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "AiProject" DROP CONSTRAINT "AiProject_sourceOpportunityId_fkey";

-- DropForeignKey
ALTER TABLE "AiTask" DROP CONSTRAINT "AiTask_assigneeId_fkey";

-- DropForeignKey
ALTER TABLE "AiTask" DROP CONSTRAINT "AiTask_projectId_fkey";

-- DropForeignKey
ALTER TABLE "ApplicationStatusHistory" DROP CONSTRAINT "ApplicationStatusHistory_applicationId_fkey";

-- DropForeignKey
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_userId_fkey";

-- DropForeignKey
ALTER TABLE "Bench" DROP CONSTRAINT "Bench_candidateId_fkey";

-- DropForeignKey
ALTER TABLE "Bench" DROP CONSTRAINT "Bench_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "CampaignMember" DROP CONSTRAINT "CampaignMember_campaignId_fkey";

-- DropForeignKey
ALTER TABLE "CandidateApplication" DROP CONSTRAINT "CandidateApplication_candidateId_fkey";

-- DropForeignKey
ALTER TABLE "CandidateApplication" DROP CONSTRAINT "CandidateApplication_jobId_fkey";

-- DropForeignKey
ALTER TABLE "CandidateApplication" DROP CONSTRAINT "CandidateApplication_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "Contact" DROP CONSTRAINT "Contact_accountId_fkey";

-- DropForeignKey
ALTER TABLE "Contact" DROP CONSTRAINT "Contact_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "Contact" DROP CONSTRAINT "Contact_sourceLeadId_fkey";

-- DropForeignKey
ALTER TABLE "EmailEvent" DROP CONSTRAINT "EmailEvent_campaignMemberId_fkey";

-- DropForeignKey
ALTER TABLE "Interview" DROP CONSTRAINT "Interview_applicationId_fkey";

-- DropForeignKey
ALTER TABLE "Interview" DROP CONSTRAINT "Interview_candidateId_fkey";

-- DropForeignKey
ALTER TABLE "Interview" DROP CONSTRAINT "Interview_jobId_fkey";

-- DropForeignKey
ALTER TABLE "Lead" DROP CONSTRAINT "Lead_convertedAccountId_fkey";

-- DropForeignKey
ALTER TABLE "Lead" DROP CONSTRAINT "Lead_convertedContactId_fkey";

-- DropForeignKey
ALTER TABLE "Lead" DROP CONSTRAINT "Lead_convertedOpportunityId_fkey";

-- DropForeignKey
ALTER TABLE "Lead" DROP CONSTRAINT "Lead_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_userId_fkey";

-- DropForeignKey
ALTER TABLE "Offer" DROP CONSTRAINT "Offer_applicationId_fkey";

-- DropForeignKey
ALTER TABLE "Offer" DROP CONSTRAINT "Offer_candidateId_fkey";

-- DropForeignKey
ALTER TABLE "Offer" DROP CONSTRAINT "Offer_interviewId_fkey";

-- DropForeignKey
ALTER TABLE "Offer" DROP CONSTRAINT "Offer_jobId_fkey";

-- DropForeignKey
ALTER TABLE "OfferRevision" DROP CONSTRAINT "OfferRevision_offerId_fkey";

-- DropForeignKey
ALTER TABLE "Opportunity" DROP CONSTRAINT "Opportunity_accountId_fkey";

-- DropForeignKey
ALTER TABLE "Opportunity" DROP CONSTRAINT "Opportunity_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "Opportunity" DROP CONSTRAINT "Opportunity_primaryContactId_fkey";

-- DropForeignKey
ALTER TABLE "Opportunity" DROP CONSTRAINT "Opportunity_sourceLeadId_fkey";

-- DropForeignKey
ALTER TABLE "OpportunityStageHistory" DROP CONSTRAINT "OpportunityStageHistory_opportunityId_fkey";

-- DropForeignKey
ALTER TABLE "Placement" DROP CONSTRAINT "Placement_benchConsultantId_fkey";

-- DropForeignKey
ALTER TABLE "Placement" DROP CONSTRAINT "Placement_submissionId_fkey";

-- DropForeignKey
ALTER TABLE "ProjectResource" DROP CONSTRAINT "ProjectResource_projectId_fkey";

-- DropForeignKey
ALTER TABLE "ProjectResource" DROP CONSTRAINT "ProjectResource_resourceId_fkey";

-- DropForeignKey
ALTER TABLE "Submission" DROP CONSTRAINT "Submission_benchConsultantId_fkey";

-- DropForeignKey
ALTER TABLE "Submission" DROP CONSTRAINT "Submission_requirementId_fkey";

-- AlterTable
ALTER TABLE "Account" ALTER COLUMN "accountType" SET DEFAULT 'Prospect';

-- AlterTable
ALTER TABLE "Bench" ADD COLUMN     "validVisa" TEXT;

-- AlterTable
ALTER TABLE "BenchInterview" ADD COLUMN     "submissionRate" INTEGER,
ADD COLUMN     "technology" TEXT,
ADD COLUMN     "vendorEmail" TEXT,
ADD COLUMN     "workLocation" TEXT,
ADD COLUMN     "workMode" TEXT,
ALTER COLUMN "submissionId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Placement" ADD COLUMN     "vendorContactNumber" TEXT,
ADD COLUMN     "vendorEmail" TEXT;

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "candidateCompany" TEXT,
ADD COLUMN     "implementationName" TEXT,
ADD COLUMN     "vendorEmail" TEXT;

-- CreateIndex
CREATE INDEX "Account_normalizedName_idx" ON "Account"("normalizedName");

-- CreateIndex
CREATE INDEX "Account_ownerId_idx" ON "Account"("ownerId");

-- CreateIndex
CREATE INDEX "Account_lifecycleStatus_idx" ON "Account"("lifecycleStatus");

-- CreateIndex
CREATE INDEX "Activity_ownerId_idx" ON "Activity"("ownerId");

-- CreateIndex
CREATE INDEX "Activity_relatedEntityType_relatedEntityId_idx" ON "Activity"("relatedEntityType", "relatedEntityId");

-- CreateIndex
CREATE INDEX "AiProject_ownerId_idx" ON "AiProject"("ownerId");

-- CreateIndex
CREATE INDEX "AiProject_accountId_idx" ON "AiProject"("accountId");

-- CreateIndex
CREATE INDEX "AiTask_projectId_idx" ON "AiTask"("projectId");

-- CreateIndex
CREATE INDEX "AiTask_assigneeId_idx" ON "AiTask"("assigneeId");

-- CreateIndex
CREATE INDEX "ApplicationStatusHistory_applicationId_createdAt_idx" ON "ApplicationStatusHistory"("applicationId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_idx" ON "AuditLog"("userId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "Bench_ownerId_idx" ON "Bench"("ownerId");

-- CreateIndex
CREATE INDEX "CampaignMember_campaignId_status_idx" ON "CampaignMember"("campaignId", "status");

-- CreateIndex
CREATE INDEX "Candidate_email_idx" ON "Candidate"("email");

-- CreateIndex
CREATE INDEX "CandidateApplication_stage_idx" ON "CandidateApplication"("stage");

-- CreateIndex
CREATE INDEX "CandidateApplication_ownerId_idx" ON "CandidateApplication"("ownerId");

-- CreateIndex
CREATE INDEX "Contact_accountId_idx" ON "Contact"("accountId");

-- CreateIndex
CREATE INDEX "Contact_sourceLeadId_idx" ON "Contact"("sourceLeadId");

-- CreateIndex
CREATE INDEX "Contact_ownerId_idx" ON "Contact"("ownerId");

-- CreateIndex
CREATE INDEX "Contact_email_idx" ON "Contact"("email");

-- CreateIndex
CREATE INDEX "EmailEvent_campaignMemberId_eventType_idx" ON "EmailEvent"("campaignMemberId", "eventType");

-- CreateIndex
CREATE INDEX "EmailEvent_occurredAt_idx" ON "EmailEvent"("occurredAt");

-- CreateIndex
CREATE INDEX "Interview_applicationId_idx" ON "Interview"("applicationId");

-- CreateIndex
CREATE INDEX "Interview_candidateId_idx" ON "Interview"("candidateId");

-- CreateIndex
CREATE INDEX "Interview_jobId_idx" ON "Interview"("jobId");

-- CreateIndex
CREATE INDEX "Job_status_idx" ON "Job"("status");

-- CreateIndex
CREATE INDEX "Lead_ownerId_idx" ON "Lead"("ownerId");

-- CreateIndex
CREATE INDEX "Lead_email_idx" ON "Lead"("email");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "Offer_applicationId_idx" ON "Offer"("applicationId");

-- CreateIndex
CREATE INDEX "Offer_candidateId_idx" ON "Offer"("candidateId");

-- CreateIndex
CREATE INDEX "Offer_jobId_idx" ON "Offer"("jobId");

-- CreateIndex
CREATE INDEX "Opportunity_accountId_idx" ON "Opportunity"("accountId");

-- CreateIndex
CREATE INDEX "Opportunity_ownerId_idx" ON "Opportunity"("ownerId");

-- CreateIndex
CREATE INDEX "Opportunity_sourceLeadId_idx" ON "Opportunity"("sourceLeadId");

-- CreateIndex
CREATE INDEX "OpportunityStageHistory_opportunityId_createdAt_idx" ON "OpportunityStageHistory"("opportunityId", "createdAt");

-- CreateIndex
CREATE INDEX "Placement_benchConsultantId_idx" ON "Placement"("benchConsultantId");

-- CreateIndex
CREATE INDEX "Placement_startDate_endDate_idx" ON "Placement"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "ProjectResource_resourceId_idx" ON "ProjectResource"("resourceId");

-- CreateIndex
CREATE INDEX "ProjectResource_projectId_idx" ON "ProjectResource"("projectId");

-- CreateIndex
CREATE INDEX "Requirement_status_idx" ON "Requirement"("status");

-- CreateIndex
CREATE INDEX "Requirement_clientCompany_idx" ON "Requirement"("clientCompany");

-- CreateIndex
CREATE INDEX "Submission_benchConsultantId_idx" ON "Submission"("benchConsultantId");

-- CreateIndex
CREATE INDEX "Submission_requirementId_idx" ON "Submission"("requirementId");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_convertedAccountId_fkey" FOREIGN KEY ("convertedAccountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_convertedContactId_fkey" FOREIGN KEY ("convertedContactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_convertedOpportunityId_fkey" FOREIGN KEY ("convertedOpportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_sourceLeadId_fkey" FOREIGN KEY ("sourceLeadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_primaryContactId_fkey" FOREIGN KEY ("primaryContactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_primaryContactId_fkey" FOREIGN KEY ("primaryContactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_sourceLeadId_fkey" FOREIGN KEY ("sourceLeadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OpportunityStageHistory" ADD CONSTRAINT "OpportunityStageHistory_opportunityId_fkey" FOREIGN KEY ("opportunityId") REFERENCES "Opportunity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignMember" ADD CONSTRAINT "CampaignMember_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailEvent" ADD CONSTRAINT "EmailEvent_campaignMemberId_fkey" FOREIGN KEY ("campaignMemberId") REFERENCES "CampaignMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateApplication" ADD CONSTRAINT "CandidateApplication_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateApplication" ADD CONSTRAINT "CandidateApplication_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CandidateApplication" ADD CONSTRAINT "CandidateApplication_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ApplicationStatusHistory" ADD CONSTRAINT "ApplicationStatusHistory_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "CandidateApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "CandidateApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "CandidateApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfferRevision" ADD CONSTRAINT "OfferRevision_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "Offer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bench" ADD CONSTRAINT "Bench_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bench" ADD CONSTRAINT "Bench_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_benchConsultantId_fkey" FOREIGN KEY ("benchConsultantId") REFERENCES "Bench"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Placement" ADD CONSTRAINT "Placement_benchConsultantId_fkey" FOREIGN KEY ("benchConsultantId") REFERENCES "Bench"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Placement" ADD CONSTRAINT "Placement_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiProject" ADD CONSTRAINT "AiProject_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiProject" ADD CONSTRAINT "AiProject_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiProject" ADD CONSTRAINT "AiProject_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiProject" ADD CONSTRAINT "AiProject_sourceOpportunityId_fkey" FOREIGN KEY ("sourceOpportunityId") REFERENCES "Opportunity"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiTask" ADD CONSTRAINT "AiTask_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiTask" ADD CONSTRAINT "AiTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AiProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectResource" ADD CONSTRAINT "ProjectResource_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AiProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectResource" ADD CONSTRAINT "ProjectResource_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "AiResource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
