-- CreateEnum
CREATE TYPE "DeployRunStatus" AS ENUM ('PENDING', 'RUNNING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "DeployRunType" AS ENUM ('DISTRIBUTE', 'VERIFY');

-- CreateTable
CREATE TABLE "EnvironmentSshConfig" (
    "id" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "sshUser" TEXT NOT NULL DEFAULT 'ansible',
    "sshPassword" TEXT,
    "privateKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnvironmentSshConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeploymentRun" (
    "id" TEXT NOT NULL,
    "environmentId" TEXT NOT NULL,
    "type" "DeployRunType" NOT NULL,
    "status" "DeployRunStatus" NOT NULL DEFAULT 'PENDING',
    "stdout" TEXT,
    "returnCode" INTEGER,
    "triggeredBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "DeploymentRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EnvironmentSshConfig_environmentId_key" ON "EnvironmentSshConfig"("environmentId");

-- CreateIndex
CREATE INDEX "DeploymentRun_environmentId_createdAt_idx" ON "DeploymentRun"("environmentId", "createdAt");

-- AddForeignKey
ALTER TABLE "EnvironmentSshConfig" ADD CONSTRAINT "EnvironmentSshConfig_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "TrinoEnvironment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeploymentRun" ADD CONSTRAINT "DeploymentRun_environmentId_fkey" FOREIGN KEY ("environmentId") REFERENCES "TrinoEnvironment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
