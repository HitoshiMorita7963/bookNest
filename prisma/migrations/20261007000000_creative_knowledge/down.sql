-- 創作知識（20261007000000_creative_knowledge）を取り消す SQL（緊急時のみ手動で実行する）
-- migration.sql は「列の追加」と「新しいテーブルの作成」だけなので、ここで消すのは創作知識のデータだけ。
-- 既存の本・フレーズ・知識・創作のデータには影響しない。
-- 実行後は _booknest_migrations から該当行を消すこと（cloud:setup が再適用できるように）。

DROP TABLE IF EXISTS "CreativeKnowledgeSource";
DROP TABLE IF EXISTS "CreativeKnowledgeReference";
DROP TABLE IF EXISTS "CreativeKnowledgeRelation";
DROP TABLE IF EXISTS "CreativeKnowledgeTag";
DROP TABLE IF EXISTS "CreativeKnowledgeCategory";
DROP TABLE IF EXISTS "CreativeKnowledge";

-- CreativeLink に追加した列（創作知識を作品につないだ行は、元が無くなるので先に消す）
DELETE FROM "CreativeLink" WHERE "ckId" IS NOT NULL;
DROP INDEX IF EXISTS "CreativeLink_ckId_idx";
ALTER TABLE "CreativeLink" DROP COLUMN "ckId";

DELETE FROM "_booknest_migrations" WHERE "name" = '20261007000000_creative_knowledge';
