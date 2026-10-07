# 創作知識（Creative Knowledge Base）

読書で得た具体例と、自分の創作をつなぐ「一般的な創作知識」のデータベース。画面は `/creative/knowledge`。

```
📚 読書（本・フレーズ・読書メモ・感想・読書の知識）
        │  CreativeKnowledgeReference（参考にした読書）
        ▼
🧠 創作知識（CreativeKnowledge）── CreativeKnowledgeRelation（知識同士の関係）
        │  CreativeLink.ckId（使っている作品）
        ▼
💡 創作メモ ／ ✍️ 作品・章・シーン・人物・プロット・世界観
```

## データ構造

| テーブル | 内容 |
| --- | --- |
| `CreativeKnowledge` | 本体。概要・定義・効果・パターン・流れ・使い方・注意点・別名は「1行に1項目」のテキスト。主カテゴリ（10区分）・サブカテゴリ・自分のメモ・お気に入り・`origin`（seed / user）・`userEdited` |
| `CreativeKnowledgeCategory` | 2つ目以降のカテゴリ |
| `CreativeKnowledgeTag` | タグ（既存の `Tag` を本・フレーズ・知識と共有） |
| `CreativeKnowledgeRelation` | 知識同士の関係。`type`: related / parent / child / similar / opposite / prerequisite / combination |
| `CreativeKnowledgeReference` | 参考にした読書。元は本・フレーズ・読書メモ・感想・読書の知識のいずれか（本棚にない作品は `workTitle`）。場所・自分の気づき |
| `CreativeKnowledgeSource` | 出典・参考資料（書籍・Web・論文・自分の考察） |
| `CreativeLink.ckId` | 創作知識を作品・章・シーンなどにつなぐ（既存の紐付けを拡張）。外部キーなしの列なので、創作知識の削除時はサービスで該当行を消す |

一般的な知識（定義・効果など）と自分の知見（`myNote`）は別の列に保存する。

## 画面

| URL | 内容 |
| --- | --- |
| `/creative/knowledge` | トップ：10カテゴリ（件数）・タグから探す・最近更新した知識・検索 |
| `/creative/knowledge?category=TROPE&sub=…` | カテゴリ別（サブカテゴリごとに区切り、サブカテゴリで絞り込み） |
| `/creative/knowledge?tag=…` | タグの創作知識 |
| `/creative/knowledge?q=…` | 検索（関連の強い順。見つかった理由を表示） |
| `/creative/knowledge/new`・`/[id]`・`/[id]/edit` | 作成・詳細・編集 |

全体検索 `/search` にも「創作知識」の結果を表示する。

## 検索（`src/server/services/creative-knowledge-search.ts`）

タイトルが完全に一致しなくても見つかるよう、項目ごとに重みをつけて採点する。

1. 文全体の一致：タイトル（最も重い）＞ 別名 ＞ タグ ＞ カテゴリ・サブカテゴリ
2. 単語ごとの部分一致：タイトル・別名・タグ・カテゴリ・説明（概要・定義・効果・パターン・流れ・使い方・注意点）・参考読書のメモ
3. 文字の 2-gram の重なり：言い換えや語順の違い（例：「敵が仲間になる」）
4. 上位5件とつながっている知識を「〇〇の関連知識」として加える

言い換えで見つけやすくするには、知識の「別名・言い換え」に書いておく。将来 Embedding（ベクトル検索）に置き換える場合も、`searchCreativeKnowledge` の戻り値の形を保てば画面と AI 側は変更不要。

## 作品との連携（`CreativeLink.ckId`）

- 紐付けの「元」の種類に `ck`（創作知識）を追加した（`LINK_SOURCE_KINDS`）。作品全体・人物・世界観・プロット・章・シーン・創作メモにつなげられる
- つなぐ場所：創作知識の詳細の「創作に使う」、作品の参考資料・人物・章・シーンの「資料を追加」（創作知識タブ）
- 逆引き：創作知識の詳細に「使用している作品」
- `ckId` はリレーションがないので、表示用のタイトル・カテゴリは `attachCk()`（`services/creative.ts`）で別に読み込んで付ける

## AI への文脈（`src/server/services/creative-knowledge-ai.ts`）

- `ckAiContext(ids, { projectId })`：定義・効果・パターン・流れ・使い方・注意点・関連知識を短く切りそろえ、自分のメモ（`myNote`）は別の項目で渡す。作品を指定すると、その作品で使っている場所も付ける
- `searchCkForAi(query)`：検索で見つかった創作知識の文脈
- `projectCkContext(projectId)`：作品に関連付けられた創作知識の文脈
- AI編集者のツール `search_creative_knowledge` と `list_project_references` から使う。AI が使えない検索モードでも、キーワードで創作知識を探す

## 本番 DB への反映（migration: `20261007000000_creative_knowledge`）

この migration は「`CreativeLink` への列の追加」と「新しいテーブルの作成」だけで、既存のテーブルを作り直したりデータを書き換えたりしない（使い捨て DB で、既存データが変わらないこと・取り消しできることを確認済み）。

Vercel は main へのマージ直後に新しいコードを公開するため、**PR をマージする前に** Turso へ反映する。

1. バックアップ：BookNest の 設定 → データ管理 →「すべてのデータ（JSON）」をダウンロードしておく
2. 反映：PC のターミナルで `npm run cloud:setup`（未適用の migration だけが流れる）
3. 確認：「✓ テーブルを作成・更新しました: 20261007000000_creative_knowledge」と表示されること
4. PR をマージ（Vercel が自動で公開）

### 取り消し（緊急時）

`prisma/migrations/20261007000000_creative_knowledge/down.sql` を Turso のシェル（`turso db shell <DB名>`）で実行する。消えるのは創作知識のデータだけで、既存の本・フレーズ・知識・創作のデータには影響しない。その後、ひとつ前のコードに戻す（Vercel の Deployments から以前のデプロイを Promote）。

## 初期データ（サンプル）

- データ：`src/server/data/creative-knowledge-seed.ts`（10カテゴリ×2〜4件。文章はすべて独自に書いたもの。「物語要素事典」「TV Tropes」は分類の考え方の参考にしたのみで、本文は転載していない）
- 読み込み：創作知識のトップに出る「📦 基本の創作知識」カードの「追加する」（`syncCkSeeds`）。DB の変更（migration）は不要
- `slug` で同じ知識を見分けるので、何度読み込んでも重複しない
  - まだない知識は追加、内容が新しくなったサンプルは更新
  - 自分で編集したサンプル（`userEdited`）は上書きしない
  - お気に入り・自分のメモ・参考にした読書・作品への紐付けは常に残る
  - 削除したサンプルは、もう一度読み込むと戻る
- 関係は同じ2つの知識の間に1つだけ書く（両方向から書くと詳細画面に2回出るため。ユニットテストで確認）
- 200〜250件への拡充は、この仕組みのままデータを追加するだけでよい
