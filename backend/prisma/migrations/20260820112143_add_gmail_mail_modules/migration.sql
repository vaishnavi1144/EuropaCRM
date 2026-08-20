-- CreateTable
CREATE TABLE "EmailAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'GMAIL',
    "email" TEXT NOT NULL,
    "displayName" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "historyId" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT,
    "module" TEXT NOT NULL,
    "gmailId" TEXT,
    "gmailThreadId" TEXT,
    "direction" TEXT NOT NULL DEFAULT 'INBOUND',
    "folder" TEXT NOT NULL DEFAULT 'INBOX',
    "fromAddress" TEXT NOT NULL,
    "toAddresses" TEXT[],
    "ccAddresses" TEXT[],
    "bccAddresses" TEXT[],
    "subject" TEXT,
    "snippet" TEXT,
    "bodyText" TEXT,
    "bodyHtml" TEXT,
    "attachments" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isStarred" BOOLEAN NOT NULL DEFAULT false,
    "isDraft" BOOLEAN NOT NULL DEFAULT false,
    "isTrashed" BOOLEAN NOT NULL DEFAULT false,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "linkedEntityType" TEXT,
    "linkedEntityId" TEXT,
    "submissionId" TEXT,
    "benchConsultantId" TEXT,
    "jobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailLabel" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#009E92',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MailLabel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MailMessageLabel" (
    "messageId" TEXT NOT NULL,
    "labelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MailMessageLabel_pkey" PRIMARY KEY ("messageId","labelId")
);

-- CreateIndex
CREATE INDEX "EmailAccount_userId_idx" ON "EmailAccount"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EmailAccount_userId_provider_email_key" ON "EmailAccount"("userId", "provider", "email");

-- CreateIndex
CREATE INDEX "MailMessage_userId_module_folder_receivedAt_idx" ON "MailMessage"("userId", "module", "folder", "receivedAt");

-- CreateIndex
CREATE INDEX "MailMessage_userId_module_gmailThreadId_idx" ON "MailMessage"("userId", "module", "gmailThreadId");

-- CreateIndex
CREATE INDEX "MailMessage_submissionId_idx" ON "MailMessage"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "MailMessage_userId_module_gmailId_key" ON "MailMessage"("userId", "module", "gmailId");

-- CreateIndex
CREATE INDEX "MailLabel_userId_module_idx" ON "MailLabel"("userId", "module");

-- CreateIndex
CREATE UNIQUE INDEX "MailLabel_userId_module_name_key" ON "MailLabel"("userId", "module", "name");

-- CreateIndex
CREATE INDEX "MailMessageLabel_labelId_idx" ON "MailMessageLabel"("labelId");

-- AddForeignKey
ALTER TABLE "EmailAccount" ADD CONSTRAINT "EmailAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailMessage" ADD CONSTRAINT "MailMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailMessage" ADD CONSTRAINT "MailMessage_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "EmailAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailLabel" ADD CONSTRAINT "MailLabel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailMessageLabel" ADD CONSTRAINT "MailMessageLabel_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "MailMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailMessageLabel" ADD CONSTRAINT "MailMessageLabel_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "MailLabel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
