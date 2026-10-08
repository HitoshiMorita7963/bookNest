-- ニュースの更新時刻の取り消し（追加した索引と列を消すだけ）
DROP INDEX IF EXISTS "NewsItem_fetchedAt_idx";
ALTER TABLE "NewsItem" DROP COLUMN "fetchedAt";
DELETE FROM "_booknest_migrations" WHERE name = '20261008120000_news_refresh';
