ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "passwordHash" TEXT NOT NULL DEFAULT '';

UPDATE "users"
SET "name" = "email"
WHERE "name" IS NULL OR length(trim("name")) = 0;

ALTER TABLE "users"
  ALTER COLUMN "name" SET NOT NULL;

ALTER TABLE "users"
  DROP COLUMN IF EXISTS "image",
  DROP COLUMN IF EXISTS "emailVerified";

DROP TABLE IF EXISTS "session";
DROP TABLE IF EXISTS "account";
DROP TABLE IF EXISTS "verification";
