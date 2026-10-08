-- CreateTable
CREATE TABLE "NewsItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT '',
    "feed" TEXT NOT NULL DEFAULT 'top',
    "publishedAt" DATETIME,
    "day" TEXT NOT NULL,
    "keyword" TEXT,
    "savedAt" DATETIME,
    "memo" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "NewsKnowledge" (
    "newsId" TEXT NOT NULL,
    "knowledgeId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("newsId", "knowledgeId"),
    CONSTRAINT "NewsKnowledge_newsId_fkey" FOREIGN KEY ("newsId") REFERENCES "NewsItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NewsKnowledge_knowledgeId_fkey" FOREIGN KEY ("knowledgeId") REFERENCES "KnowledgeNote" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "NewsItem_url_key" ON "NewsItem"("url");

-- CreateIndex
CREATE INDEX "NewsItem_day_idx" ON "NewsItem"("day");

-- CreateIndex
CREATE INDEX "NewsItem_savedAt_idx" ON "NewsItem"("savedAt");

-- CreateIndex
CREATE INDEX "NewsKnowledge_knowledgeId_idx" ON "NewsKnowledge"("knowledgeId");

