-- CreateTable
CREATE TABLE "registration_invite_code" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "registration_invite_code_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "registration_invite_code_code_key" ON "registration_invite_code"("code");

-- CreateIndex
CREATE INDEX "registration_invite_code_expiresAt_revoked_idx" ON "registration_invite_code"("expiresAt", "revoked");

-- CreateIndex
CREATE INDEX "registration_invite_code_createdById_idx" ON "registration_invite_code"("createdById");

-- AddForeignKey
ALTER TABLE "registration_invite_code" ADD CONSTRAINT "registration_invite_code_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Organization memberships and outstanding invitations are owner/member only.
WITH "ownerCandidates" AS (
    SELECT DISTINCT ON ("organizationId") "id"
    FROM "member" AS candidate
    WHERE NOT EXISTS (
        SELECT 1
        FROM "member" AS existing_owner
        WHERE existing_owner."organizationId" = candidate."organizationId"
          AND existing_owner."role" = 'owner'
    )
    ORDER BY "organizationId", "createdAt", "id"
)
UPDATE "member"
SET "role" = 'owner'
WHERE "id" IN (SELECT "id" FROM "ownerCandidates");

UPDATE "member" SET "role" = 'member' WHERE "role" = 'admin';
UPDATE "invitation" SET "role" = 'member' WHERE "role" = 'admin';
