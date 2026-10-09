-- 物語要素事典（よみ・作品例）の取り消し（追加した列を消すだけ）
ALTER TABLE "CreativeKnowledge" DROP COLUMN "reading";
ALTER TABLE "CreativeKnowledge" DROP COLUMN "examples";
DELETE FROM "_booknest_migrations" WHERE name = '20261009000000_story_dictionary';
