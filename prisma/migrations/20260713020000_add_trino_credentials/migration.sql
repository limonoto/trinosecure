-- Add Trino HTTP API credentials to TrinoEnvironment.
-- trinoUsername is stored in plain text (not sensitive).
-- trinoPassword is stored AES-256-GCM encrypted (same scheme as SSH credentials).

ALTER TABLE "TrinoEnvironment" ADD COLUMN "trinoUsername" TEXT;
ALTER TABLE "TrinoEnvironment" ADD COLUMN "trinoPassword" TEXT;
