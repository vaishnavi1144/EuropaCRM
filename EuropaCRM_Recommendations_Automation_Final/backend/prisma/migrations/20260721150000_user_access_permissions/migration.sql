-- Add per-user module access without changing existing role-based behaviour.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "permissions" JSONB;
