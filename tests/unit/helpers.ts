import { PrismaClient } from "@prisma/client";

export const db = new PrismaClient({ datasourceUrl: "file:../tests/.tmp/test.db" });

/** 全テーブルを空にする（外部キーの順序に注意） */
export async function resetDb() {
  await db.creativeLink.deleteMany();
  await db.creativeNoteTag.deleteMany();
  await db.creativeNote.deleteMany();
  await db.characterRelationship.deleteMany();
  await db.scene.deleteMany();
  await db.chapter.deleteMany();
  await db.plot.deleteMany();
  await db.worldSetting.deleteMany();
  await db.character.deleteMany();
  await db.novelProject.deleteMany();
  await db.aIMessage.deleteMany();
  await db.aIConversation.deleteMany();
  await db.readingPathBook.deleteMany();
  await db.readingPath.deleteMany();
  await db.knowledgeLink.deleteMany();
  await db.quoteKnowledge.deleteMany();
  await db.bookKnowledge.deleteMany();
  await db.knowledgeTag.deleteMany();
  await db.knowledgeNote.deleteMany();
  await db.quoteTag.deleteMany();
  await db.quote.deleteMany();
  await db.shelfBook.deleteMany();
  await db.customShelf.deleteMany();
  await db.readingSession.deleteMany();
  await db.readingRecord.deleteMany();
  await db.bookRelation.deleteMany();
  await db.bookTag.deleteMany();
  await db.bookAuthor.deleteMany();
  await db.book.deleteMany();
  await db.series.deleteMany();
  await db.author.deleteMany();
  await db.tag.deleteMany();
  await db.readingGoal.deleteMany();
}
