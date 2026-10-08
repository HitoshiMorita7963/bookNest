import { PrismaClient } from "@prisma/client";

export const db = new PrismaClient({ datasourceUrl: "file:../tests/.tmp/test.db" });

/** 全テーブルを空にする（外部キーの順序に注意） */
export async function resetDb() {
  await db.newsKnowledge.deleteMany();
  await db.newsItem.deleteMany();
  await db.creativeLink.deleteMany();
  await db.creativeKnowledgeSource.deleteMany();
  await db.creativeKnowledgeReference.deleteMany();
  await db.creativeKnowledgeRelation.deleteMany();
  await db.creativeKnowledgeTag.deleteMany();
  await db.creativeKnowledgeCategory.deleteMany();
  await db.creativeKnowledge.deleteMany();
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
  // 設定（AI の利用・削除したサンプルの記録など）もテストごとに初期化する
  await db.user.deleteMany();
}
