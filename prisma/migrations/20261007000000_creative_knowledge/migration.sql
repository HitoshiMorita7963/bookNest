-- AlterTable
ALTER TABLE "CreativeLink" ADD COLUMN "ckId" TEXT;

-- CreateTable
CREATE TABLE "CreativeKnowledge" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "slug" TEXT,
    "summary" TEXT NOT NULL DEFAULT '',
    "definition" TEXT NOT NULL DEFAULT '',
    "effects" TEXT NOT NULL DEFAULT '',
    "patterns" TEXT NOT NULL DEFAULT '',
    "flow" TEXT NOT NULL DEFAULT '',
    "usage" TEXT NOT NULL DEFAULT '',
    "cautions" TEXT NOT NULL DEFAULT '',
    "aliases" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL,
    "subCategory" TEXT,
    "myNote" TEXT NOT NULL DEFAULT '',
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "origin" TEXT NOT NULL DEFAULT 'user',
    "userEdited" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CreativeKnowledgeCategory" (
    "knowledgeId" TEXT NOT NULL,
    "category" TEXT NOT NULL,

    PRIMARY KEY ("knowledgeId", "category"),
    CONSTRAINT "CreativeKnowledgeCategory_knowledgeId_fkey" FOREIGN KEY ("knowledgeId") REFERENCES "CreativeKnowledge" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CreativeKnowledgeTag" (
    "knowledgeId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    PRIMARY KEY ("knowledgeId", "tagId"),
    CONSTRAINT "CreativeKnowledgeTag_knowledgeId_fkey" FOREIGN KEY ("knowledgeId") REFERENCES "CreativeKnowledge" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CreativeKnowledgeTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CreativeKnowledgeRelation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'related',
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreativeKnowledgeRelation_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "CreativeKnowledge" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CreativeKnowledgeRelation_toId_fkey" FOREIGN KEY ("toId") REFERENCES "CreativeKnowledge" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CreativeKnowledgeReference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "knowledgeId" TEXT NOT NULL,
    "bookId" TEXT,
    "quoteId" TEXT,
    "sessionId" TEXT,
    "recordId" TEXT,
    "knowledgeNoteId" TEXT,
    "workTitle" TEXT,
    "location" TEXT,
    "comment" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreativeKnowledgeReference_knowledgeId_fkey" FOREIGN KEY ("knowledgeId") REFERENCES "CreativeKnowledge" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CreativeKnowledgeReference_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CreativeKnowledgeReference_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CreativeKnowledgeReference_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ReadingSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CreativeKnowledgeReference_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "ReadingRecord" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CreativeKnowledgeReference_knowledgeNoteId_fkey" FOREIGN KEY ("knowledgeNoteId") REFERENCES "KnowledgeNote" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CreativeKnowledgeSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "knowledgeId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'BOOK',
    "title" TEXT NOT NULL,
    "url" TEXT,
    "note" TEXT,
    "bookId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreativeKnowledgeSource_knowledgeId_fkey" FOREIGN KEY ("knowledgeId") REFERENCES "CreativeKnowledge" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CreativeKnowledgeSource_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "CreativeKnowledge_slug_key" ON "CreativeKnowledge"("slug");

-- CreateIndex
CREATE INDEX "CreativeKnowledge_category_idx" ON "CreativeKnowledge"("category");

-- CreateIndex
CREATE INDEX "CreativeKnowledge_isFavorite_idx" ON "CreativeKnowledge"("isFavorite");

-- CreateIndex
CREATE INDEX "CreativeKnowledge_updatedAt_idx" ON "CreativeKnowledge"("updatedAt");

-- CreateIndex
CREATE INDEX "CreativeKnowledgeCategory_category_idx" ON "CreativeKnowledgeCategory"("category");

-- CreateIndex
CREATE INDEX "CreativeKnowledgeTag_tagId_idx" ON "CreativeKnowledgeTag"("tagId");

-- CreateIndex
CREATE INDEX "CreativeKnowledgeRelation_toId_idx" ON "CreativeKnowledgeRelation"("toId");

-- CreateIndex
CREATE UNIQUE INDEX "CreativeKnowledgeRelation_fromId_toId_type_key" ON "CreativeKnowledgeRelation"("fromId", "toId", "type");

-- CreateIndex
CREATE INDEX "CreativeKnowledgeReference_knowledgeId_idx" ON "CreativeKnowledgeReference"("knowledgeId");

-- CreateIndex
CREATE INDEX "CreativeKnowledgeReference_bookId_idx" ON "CreativeKnowledgeReference"("bookId");

-- CreateIndex
CREATE INDEX "CreativeKnowledgeReference_quoteId_idx" ON "CreativeKnowledgeReference"("quoteId");

-- CreateIndex
CREATE INDEX "CreativeKnowledgeReference_sessionId_idx" ON "CreativeKnowledgeReference"("sessionId");

-- CreateIndex
CREATE INDEX "CreativeKnowledgeReference_recordId_idx" ON "CreativeKnowledgeReference"("recordId");

-- CreateIndex
CREATE INDEX "CreativeKnowledgeReference_knowledgeNoteId_idx" ON "CreativeKnowledgeReference"("knowledgeNoteId");

-- CreateIndex
CREATE INDEX "CreativeKnowledgeSource_knowledgeId_idx" ON "CreativeKnowledgeSource"("knowledgeId");

-- CreateIndex
CREATE INDEX "CreativeKnowledgeSource_bookId_idx" ON "CreativeKnowledgeSource"("bookId");

-- CreateIndex
CREATE INDEX "CreativeLink_ckId_idx" ON "CreativeLink"("ckId");

