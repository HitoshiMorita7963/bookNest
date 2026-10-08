-- 本日のニュースの取り消し（新しく作った表を消すだけ。既存の表には触れない）
DROP TABLE IF EXISTS "NewsKnowledge";
DROP TABLE IF EXISTS "NewsItem";
DELETE FROM "_booknest_migrations" WHERE name = '20261008000000_today_news';
