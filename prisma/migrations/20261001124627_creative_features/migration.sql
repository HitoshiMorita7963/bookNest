-- AlterTable
ALTER TABLE "AIConversation" ADD COLUMN "projectId" TEXT;

-- CreateTable
CREATE TABLE "CreativeNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'OTHER',
    "status" TEXT NOT NULL DEFAULT 'IDEA',
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CreativeNoteTag" (
    "noteId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    PRIMARY KEY ("noteId", "tagId"),
    CONSTRAINT "CreativeNoteTag_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "CreativeNote" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CreativeNoteTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NovelProject" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "logline" TEXT,
    "synopsis" TEXT,
    "theme" TEXT,
    "genre" TEXT,
    "status" TEXT NOT NULL DEFAULT 'IDEA',
    "isSample" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Character" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT,
    "age" TEXT,
    "appearance" TEXT,
    "personality" TEXT,
    "background" TEXT,
    "goal" TEXT,
    "conflict" TEXT,
    "speechStyle" TEXT,
    "notes" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Character_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "NovelProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CharacterRelationship" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CharacterRelationship_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "NovelProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CharacterRelationship_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CharacterRelationship_toId_fkey" FOREIGN KEY ("toId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorldSetting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'その他',
    "content" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorldSetting_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "NovelProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Plot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'IDEA',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Plot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "NovelProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Chapter" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Chapter_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "NovelProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Scene" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "chapterId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "content" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'IDEA',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Scene_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CreativeLink" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "bookId" TEXT,
    "quoteId" TEXT,
    "knowledgeId" TEXT,
    "noteId" TEXT,
    "projectId" TEXT,
    "characterId" TEXT,
    "worldId" TEXT,
    "plotId" TEXT,
    "chapterId" TEXT,
    "sceneId" TEXT,
    "targetNoteId" TEXT,
    "purpose" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreativeLink_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CreativeLink_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CreativeLink_knowledgeId_fkey" FOREIGN KEY ("knowledgeId") REFERENCES "KnowledgeNote" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CreativeLink_noteId_fkey" FOREIGN KEY ("noteId") REFERENCES "CreativeNote" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CreativeLink_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "NovelProject" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CreativeLink_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CreativeLink_worldId_fkey" FOREIGN KEY ("worldId") REFERENCES "WorldSetting" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CreativeLink_plotId_fkey" FOREIGN KEY ("plotId") REFERENCES "Plot" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CreativeLink_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CreativeLink_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CreativeLink_targetNoteId_fkey" FOREIGN KEY ("targetNoteId") REFERENCES "CreativeNote" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "CreativeNote_category_idx" ON "CreativeNote"("category");

-- CreateIndex
CREATE INDEX "CreativeNote_status_idx" ON "CreativeNote"("status");

-- CreateIndex
CREATE INDEX "CreativeNote_updatedAt_idx" ON "CreativeNote"("updatedAt");

-- CreateIndex
CREATE INDEX "CreativeNoteTag_tagId_idx" ON "CreativeNoteTag"("tagId");

-- CreateIndex
CREATE INDEX "NovelProject_status_idx" ON "NovelProject"("status");

-- CreateIndex
CREATE INDEX "NovelProject_updatedAt_idx" ON "NovelProject"("updatedAt");

-- CreateIndex
CREATE INDEX "Character_projectId_idx" ON "Character"("projectId");

-- CreateIndex
CREATE INDEX "CharacterRelationship_projectId_idx" ON "CharacterRelationship"("projectId");

-- CreateIndex
CREATE INDEX "CharacterRelationship_fromId_idx" ON "CharacterRelationship"("fromId");

-- CreateIndex
CREATE INDEX "CharacterRelationship_toId_idx" ON "CharacterRelationship"("toId");

-- CreateIndex
CREATE INDEX "WorldSetting_projectId_idx" ON "WorldSetting"("projectId");

-- CreateIndex
CREATE INDEX "Plot_projectId_idx" ON "Plot"("projectId");

-- CreateIndex
CREATE INDEX "Chapter_projectId_idx" ON "Chapter"("projectId");

-- CreateIndex
CREATE INDEX "Scene_chapterId_idx" ON "Scene"("chapterId");

-- CreateIndex
CREATE INDEX "CreativeLink_bookId_idx" ON "CreativeLink"("bookId");

-- CreateIndex
CREATE INDEX "CreativeLink_quoteId_idx" ON "CreativeLink"("quoteId");

-- CreateIndex
CREATE INDEX "CreativeLink_knowledgeId_idx" ON "CreativeLink"("knowledgeId");

-- CreateIndex
CREATE INDEX "CreativeLink_noteId_idx" ON "CreativeLink"("noteId");

-- CreateIndex
CREATE INDEX "CreativeLink_projectId_idx" ON "CreativeLink"("projectId");

-- CreateIndex
CREATE INDEX "CreativeLink_characterId_idx" ON "CreativeLink"("characterId");

-- CreateIndex
CREATE INDEX "CreativeLink_worldId_idx" ON "CreativeLink"("worldId");

-- CreateIndex
CREATE INDEX "CreativeLink_plotId_idx" ON "CreativeLink"("plotId");

-- CreateIndex
CREATE INDEX "CreativeLink_chapterId_idx" ON "CreativeLink"("chapterId");

-- CreateIndex
CREATE INDEX "CreativeLink_sceneId_idx" ON "CreativeLink"("sceneId");

-- CreateIndex
CREATE INDEX "CreativeLink_targetNoteId_idx" ON "CreativeLink"("targetNoteId");

-- CreateIndex
CREATE INDEX "AIConversation_projectId_idx" ON "AIConversation"("projectId");
