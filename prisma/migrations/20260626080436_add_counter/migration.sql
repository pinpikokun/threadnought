-- AlterTable
ALTER TABLE "_OperatorAccounts" ADD CONSTRAINT "_OperatorAccounts_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_OperatorAccounts_AB_unique";

-- AlterTable
ALTER TABLE "_TicketLabels" ADD CONSTRAINT "_TicketLabels_AB_pkey" PRIMARY KEY ("A", "B");

-- DropIndex
DROP INDEX "_TicketLabels_AB_unique";

-- CreateTable
CREATE TABLE "Counter" (
    "prefix" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Counter_pkey" PRIMARY KEY ("prefix")
);
