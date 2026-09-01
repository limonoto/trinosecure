-- AlterTable
ALTER TABLE "ClusterMetric" ADD COLUMN     "totalInputBytes" BIGINT,
ADD COLUMN     "totalShuffledBytes" BIGINT;

-- AlterTable
ALTER TABLE "QueryStat" ADD COLUMN     "physicalInputBytes" BIGINT,
ADD COLUMN     "physicalWrittenBytes" BIGINT,
ADD COLUMN     "shuffledBytes" BIGINT;
