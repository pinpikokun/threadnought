-- AlterTable
ALTER TABLE "Attachment" ADD COLUMN "contentId" TEXT;
ALTER TABLE "Attachment" ADD COLUMN "inline" BOOLEAN NOT NULL DEFAULT false;
