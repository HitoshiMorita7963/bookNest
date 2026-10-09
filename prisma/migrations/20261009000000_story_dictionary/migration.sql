-- 物語要素事典：創作知識に「よみ」と「作品例」を追加する（列を足すだけ。既存のデータは変えない）
ALTER TABLE "CreativeKnowledge" ADD COLUMN "reading" TEXT NOT NULL DEFAULT '';
ALTER TABLE "CreativeKnowledge" ADD COLUMN "examples" TEXT NOT NULL DEFAULT '';
