-- CreateTable
CREATE TABLE "organization_join_code" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "organization_join_code_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organization_join_code_code_key" ON "organization_join_code"("code");

-- CreateIndex
CREATE INDEX "organization_join_code_organizationId_idx" ON "organization_join_code"("organizationId");

-- CreateIndex
CREATE INDEX "organization_join_code_expiresAt_revoked_idx" ON "organization_join_code"("expiresAt", "revoked");

-- CreateIndex
CREATE INDEX "organization_join_code_createdById_idx" ON "organization_join_code"("createdById");

-- AddForeignKey
ALTER TABLE "organization_join_code" ADD CONSTRAINT "organization_join_code_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organization_join_code" ADD CONSTRAINT "organization_join_code_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
