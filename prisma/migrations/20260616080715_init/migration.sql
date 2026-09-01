-- CreateEnum
CREATE TYPE "EnvironmentDeliveryMode" AS ENUM ('HTTP', 'FILE');

-- CreateEnum
CREATE TYPE "ConfigArtifactType" AS ENUM ('RULES_JSON', 'CATALOG_RULES_JSON', 'ACCESS_CONTROL_PROPERTIES', 'AUTH_PROPERTIES', 'GROUP_PROVIDER', 'USER_MAPPING', 'TLS_CERT', 'SECRET_REF');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'IMPORT', 'EXPORT', 'PUBLISH', 'ROLLBACK');

-- CreateTable
CREATE TABLE "TrinoEnvironment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deliveryMode" "EnvironmentDeliveryMode" NOT NULL DEFAULT 'HTTP',
    "configTarget" TEXT NOT NULL,
    "refreshPeriod" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrinoEnvironment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppGroup" (
    "id" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppGroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AppGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfigArtifact" (
    "id" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "type" "ConfigArtifactType" NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConfigArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfigVersion" (
    "id" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfigVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "environmentId" TEXT,
    "actorUsername" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TrinoEnvironment_name_key" ON "TrinoEnvironment"("name");

-- CreateIndex
CREATE INDEX "AppGroup_environmentId_idx" ON "AppGroup"("environmentId");

-- CreateIndex
CREATE UNIQUE INDEX "AppGroup_environmentId_name_key" ON "AppGroup"("environmentId", "name");

-- CreateIndex
CREATE INDEX "AppGroupMember_groupId_idx" ON "AppGroupMember"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "AppGroupMember_groupId_username_key" ON "AppGroupMember"("groupId", "username");

-- CreateIndex
CREATE INDEX "ConfigArtifact_environmentId_idx" ON "ConfigArtifact"("environmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ConfigArtifact_environmentId_type_name_key" ON "ConfigArtifact"("environmentId", "type", "name");

-- CreateIndex
CREATE INDEX "ConfigVersion_artifactId_idx" ON "ConfigVersion"("artifactId");

-- CreateIndex
CREATE UNIQUE INDEX "ConfigVersion_artifactId_version_key" ON "ConfigVersion"("artifactId", "version");

-- CreateIndex
CREATE INDEX "AuditLog_environmentId_idx" ON "AuditLog"("environmentId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "AppGroup" ADD CONSTRAINT "AppGroup_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "TrinoEnvironment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AppGroupMember" ADD CONSTRAINT "AppGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "AppGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfigArtifact" ADD CONSTRAINT "ConfigArtifact_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "TrinoEnvironment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfigVersion" ADD CONSTRAINT "ConfigVersion_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "ConfigArtifact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "TrinoEnvironment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
