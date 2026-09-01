-- CreateEnum
CREATE TYPE "AppRole" AS ENUM ('VIEWER', 'CONFIG_EDITOR', 'PLATFORM_ADMIN');

-- CreateEnum
CREATE TYPE "TrinoNodeType" AS ENUM ('COORDINATOR', 'WORKER');

-- CreateEnum
CREATE TYPE "PasswordEncoding" AS ENUM ('BCRYPT', 'PBKDF2');

-- CreateEnum
CREATE TYPE "AlertKind" AS ENUM ('STATIC', 'DYNAMIC');

-- CreateEnum
CREATE TYPE "AlertComparator" AS ENUM ('GT', 'GTE', 'LT', 'LTE');

-- CreateEnum
CREATE TYPE "AlertStatus" AS ENUM ('FIRING', 'RESOLVED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditAction" ADD VALUE 'DEPLOY';
ALTER TYPE "AuditAction" ADD VALUE 'RESTART';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ConfigArtifactType" ADD VALUE 'RESOURCE_GROUPS_JSON';
ALTER TYPE "ConfigArtifactType" ADD VALUE 'CATALOG_PROPERTIES';

-- CreateTable
CREATE TABLE "AppUserRole" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "role" "AppRole" NOT NULL DEFAULT 'VIEWER',
    "environmentId" TEXT,
    "scopeConfigTypes" "ConfigArtifactType"[],
    "scopeResourceGroups" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppUserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrinoNode" (
    "id" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "host" TEXT NOT NULL,
    "type" "TrinoNodeType" NOT NULL DEFAULT 'WORKER',
    "lastSeen" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrinoNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordEntry" (
    "id" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "encoding" "PasswordEncoding" NOT NULL DEFAULT 'BCRYPT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PasswordEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogConfig" (
    "id" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "connector" TEXT NOT NULL,
    "properties" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CatalogConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QueryStat" (
    "id" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "queryId" TEXT NOT NULL,
    "username" TEXT,
    "resourceGroup" TEXT,
    "state" TEXT NOT NULL,
    "errorType" TEXT,
    "errorCode" TEXT,
    "queuedMs" INTEGER,
    "analysisMs" INTEGER,
    "planningMs" INTEGER,
    "executionMs" INTEGER,
    "elapsedMs" INTEGER,
    "createTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "collectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QueryStat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NodeMetric" (
    "id" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "nodeId" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL,
    "cpuPercent" DOUBLE PRECISION,
    "heapUsedBytes" BIGINT,
    "heapMaxBytes" BIGINT,
    "nonHeapBytes" BIGINT,
    "activeTasks" INTEGER,
    "failedTasks" INTEGER,

    CONSTRAINT "NodeMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClusterMetric" (
    "id" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL,
    "runningQueries" INTEGER,
    "queuedQueries" INTEGER,
    "blockedQueries" INTEGER,
    "activeWorkers" INTEGER,
    "runningDrivers" INTEGER,

    CONSTRAINT "ClusterMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ErrorBucket" (
    "id" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "bucketStart" TIMESTAMP(3) NOT NULL,
    "errorType" TEXT NOT NULL,
    "username" TEXT NOT NULL DEFAULT '',
    "resourceGroup" TEXT NOT NULL DEFAULT '',
    "count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ErrorBucket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertRule" (
    "id" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "AlertKind" NOT NULL DEFAULT 'STATIC',
    "metric" TEXT NOT NULL,
    "comparator" "AlertComparator" NOT NULL DEFAULT 'GT',
    "threshold" DOUBLE PRECISION NOT NULL,
    "window" TEXT NOT NULL DEFAULT '5m',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertEvent" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "value" DOUBLE PRECISION NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'FIRING',

    CONSTRAINT "AlertEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AppUserRole_environmentId_idx" ON "AppUserRole"("environmentId");

-- CreateIndex
CREATE UNIQUE INDEX "AppUserRole_username_environmentId_key" ON "AppUserRole"("username", "environmentId");

-- CreateIndex
CREATE INDEX "TrinoNode_environmentId_idx" ON "TrinoNode"("environmentId");

-- CreateIndex
CREATE UNIQUE INDEX "TrinoNode_environmentId_nodeId_key" ON "TrinoNode"("environmentId", "nodeId");

-- CreateIndex
CREATE INDEX "PasswordEntry_environmentId_idx" ON "PasswordEntry"("environmentId");

-- CreateIndex
CREATE UNIQUE INDEX "PasswordEntry_environmentId_username_key" ON "PasswordEntry"("environmentId", "username");

-- CreateIndex
CREATE INDEX "CatalogConfig_environmentId_idx" ON "CatalogConfig"("environmentId");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogConfig_environmentId_name_key" ON "CatalogConfig"("environmentId", "name");

-- CreateIndex
CREATE INDEX "QueryStat_environmentId_createTime_idx" ON "QueryStat"("environmentId", "createTime");

-- CreateIndex
CREATE INDEX "QueryStat_environmentId_errorType_idx" ON "QueryStat"("environmentId", "errorType");

-- CreateIndex
CREATE INDEX "QueryStat_environmentId_resourceGroup_idx" ON "QueryStat"("environmentId", "resourceGroup");

-- CreateIndex
CREATE UNIQUE INDEX "QueryStat_environmentId_queryId_key" ON "QueryStat"("environmentId", "queryId");

-- CreateIndex
CREATE INDEX "NodeMetric_environmentId_ts_idx" ON "NodeMetric"("environmentId", "ts");

-- CreateIndex
CREATE INDEX "NodeMetric_environmentId_nodeId_ts_idx" ON "NodeMetric"("environmentId", "nodeId", "ts");

-- CreateIndex
CREATE INDEX "ClusterMetric_environmentId_ts_idx" ON "ClusterMetric"("environmentId", "ts");

-- CreateIndex
CREATE INDEX "ErrorBucket_environmentId_bucketStart_idx" ON "ErrorBucket"("environmentId", "bucketStart");

-- CreateIndex
CREATE UNIQUE INDEX "ErrorBucket_environmentId_bucketStart_errorType_username_re_key" ON "ErrorBucket"("environmentId", "bucketStart", "errorType", "username", "resourceGroup");

-- CreateIndex
CREATE INDEX "AlertRule_environmentId_idx" ON "AlertRule"("environmentId");

-- CreateIndex
CREATE INDEX "AlertEvent_ruleId_ts_idx" ON "AlertEvent"("ruleId", "ts");

-- AddForeignKey
ALTER TABLE "AppUserRole" ADD CONSTRAINT "AppUserRole_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "TrinoEnvironment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrinoNode" ADD CONSTRAINT "TrinoNode_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "TrinoEnvironment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PasswordEntry" ADD CONSTRAINT "PasswordEntry_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "TrinoEnvironment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogConfig" ADD CONSTRAINT "CatalogConfig_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "TrinoEnvironment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueryStat" ADD CONSTRAINT "QueryStat_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "TrinoEnvironment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NodeMetric" ADD CONSTRAINT "NodeMetric_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "TrinoEnvironment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClusterMetric" ADD CONSTRAINT "ClusterMetric_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "TrinoEnvironment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ErrorBucket" ADD CONSTRAINT "ErrorBucket_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "TrinoEnvironment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertRule" ADD CONSTRAINT "AlertRule_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "TrinoEnvironment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertEvent" ADD CONSTRAINT "AlertEvent_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AlertRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
