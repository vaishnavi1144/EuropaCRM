CREATE TABLE "MailGroup" (
  "id" TEXT NOT NULL,
  "ownerUserId" TEXT NOT NULL,
  "module" TEXT NOT NULL,
  "groupName" TEXT NOT NULL,
  "description" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MailGroup_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "MailGroupMember" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MailGroupMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MailGroup_ownerUserId_module_groupName_key" ON "MailGroup"("ownerUserId", "module", "groupName");
CREATE INDEX "MailGroup_ownerUserId_module_idx" ON "MailGroup"("ownerUserId", "module");
CREATE INDEX "MailGroup_ownerUserId_module_updatedAt_idx" ON "MailGroup"("ownerUserId", "module", "updatedAt");
CREATE UNIQUE INDEX "MailGroupMember_groupId_entityType_entityId_key" ON "MailGroupMember"("groupId", "entityType", "entityId");
CREATE INDEX "MailGroupMember_groupId_idx" ON "MailGroupMember"("groupId");
CREATE INDEX "MailGroupMember_entityType_entityId_idx" ON "MailGroupMember"("entityType", "entityId");
ALTER TABLE "MailGroup" ADD CONSTRAINT "MailGroup_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MailGroupMember" ADD CONSTRAINT "MailGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "MailGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
