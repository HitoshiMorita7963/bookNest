-- AlterTable
ALTER TABLE "NewsItem" ADD COLUMN "fetchedAt" DATETIME;

-- CreateIndex
CREATE INDEX "NewsItem_fetchedAt_idx" ON "NewsItem"("fetchedAt");

