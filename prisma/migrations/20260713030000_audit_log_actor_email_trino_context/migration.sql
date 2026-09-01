ALTER TABLE "AuditLog" ADD COLUMN "actorEmail"  TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "trinoEnvName" TEXT;
ALTER TABLE "AuditLog" ADD COLUMN "trinoBaseUrl" TEXT;

CREATE INDEX "AuditLog_actorEmail_idx" ON "AuditLog"("actorEmail");
