-- CreateEnum
CREATE TYPE "AdminAuditAction" AS ENUM ('OPERATOR_CREATED', 'OPERATOR_UPDATED', 'OPERATOR_PASSWORD_RESET', 'LABEL_CREATED', 'LABEL_UPDATED', 'LABEL_DELETED', 'ACCOUNT_CREATED', 'ACCOUNT_UPDATED');

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" "AdminAuditAction" NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_targetType_targetId_idx" ON "AdminAuditLog"("targetType", "targetId");

-- AddForeignKey
ALTER TABLE "AdminAuditLog" ADD CONSTRAINT "AdminAuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Operator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
