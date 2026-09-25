-- CreateTable
CREATE TABLE "Candidate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "skills" TEXT NOT NULL,
    "experienceYears" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'New',
    "resumeUrl" TEXT,
    "ownerName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Candidate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "experienceRequired" TEXT,
    "jobType" TEXT NOT NULL DEFAULT 'Full-Time',
    "location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Open',
    "salaryRange" TEXT,
    "ownerName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interview" (
    "id" TEXT NOT NULL,
    "candidateName" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "interviewDate" TEXT,
    "interviewTime" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Scheduled',
    "interviewer" TEXT NOT NULL,
    "feedback" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Interview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "candidateName" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "offerAmount" INTEGER NOT NULL DEFAULT 0,
    "joiningDate" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "ownerName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bench" (
    "id" TEXT NOT NULL,
    "candidateName" TEXT NOT NULL,
    "skills" TEXT NOT NULL,
    "visaStatus" TEXT NOT NULL,
    "experienceYears" INTEGER NOT NULL DEFAULT 0,
    "marketingStatus" TEXT NOT NULL DEFAULT 'Active',
    "ratePerHour" INTEGER NOT NULL DEFAULT 0,
    "resumeUrl" TEXT,
    "ownerName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Bench_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "candidateName" TEXT NOT NULL,
    "vendorCompany" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "ratePerHour" INTEGER NOT NULL DEFAULT 0,
    "submissionDate" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Submitted',
    "feedback" TEXT,
    "ownerName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Placement" (
    "id" TEXT NOT NULL,
    "candidateName" TEXT NOT NULL,
    "clientCompany" TEXT NOT NULL,
    "vendorCompany" TEXT NOT NULL,
    "billingRate" INTEGER NOT NULL DEFAULT 0,
    "startDate" TEXT,
    "endDate" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "ownerName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Placement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiProject" (
    "id" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "description" TEXT,
    "techStack" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Planning',
    "startDate" TEXT,
    "endDate" TEXT,
    "leadEngineer" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiTask" (
    "id" TEXT NOT NULL,
    "taskName" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Todo',
    "priority" TEXT NOT NULL DEFAULT 'Medium',
    "assignee" TEXT NOT NULL,
    "dueDate" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiResource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "allocationStatus" TEXT NOT NULL DEFAULT 'Available',
    "skillLevel" TEXT NOT NULL DEFAULT 'Intermediate',
    "costPerHour" INTEGER NOT NULL DEFAULT 0,
    "ownerName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiResource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Candidate_name_idx" ON "Candidate"("name");

-- CreateIndex
CREATE INDEX "Candidate_status_idx" ON "Candidate"("status");

-- CreateIndex
CREATE INDEX "Job_jobTitle_idx" ON "Job"("jobTitle");

-- CreateIndex
CREATE INDEX "Job_company_idx" ON "Job"("company");

-- CreateIndex
CREATE INDEX "Interview_candidateName_idx" ON "Interview"("candidateName");

-- CreateIndex
CREATE INDEX "Interview_status_idx" ON "Interview"("status");

-- CreateIndex
CREATE INDEX "Offer_candidateName_idx" ON "Offer"("candidateName");

-- CreateIndex
CREATE INDEX "Offer_status_idx" ON "Offer"("status");

-- CreateIndex
CREATE INDEX "Bench_candidateName_idx" ON "Bench"("candidateName");

-- CreateIndex
CREATE INDEX "Bench_marketingStatus_idx" ON "Bench"("marketingStatus");

-- CreateIndex
CREATE INDEX "Submission_candidateName_idx" ON "Submission"("candidateName");

-- CreateIndex
CREATE INDEX "Submission_status_idx" ON "Submission"("status");

-- CreateIndex
CREATE INDEX "Placement_candidateName_idx" ON "Placement"("candidateName");

-- CreateIndex
CREATE INDEX "Placement_status_idx" ON "Placement"("status");

-- CreateIndex
CREATE INDEX "AiProject_projectName_idx" ON "AiProject"("projectName");

-- CreateIndex
CREATE INDEX "AiProject_status_idx" ON "AiProject"("status");

-- CreateIndex
CREATE INDEX "AiTask_taskName_idx" ON "AiTask"("taskName");

-- CreateIndex
CREATE INDEX "AiTask_status_idx" ON "AiTask"("status");

-- CreateIndex
CREATE INDEX "AiResource_name_idx" ON "AiResource"("name");

-- CreateIndex
CREATE INDEX "AiResource_allocationStatus_idx" ON "AiResource"("allocationStatus");
