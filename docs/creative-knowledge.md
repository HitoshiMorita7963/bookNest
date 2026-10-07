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

## 本番 DB への反映（migration: `20261007000000_creative_knowledge`）

この migration は「`CreativeLink` への列の追加」と「新しいテーブルの作成」だけで、既存のテーブルを作り直したりデータを書き換えたりしない（使い捨て DB で、既存データが変わらないこと・取り消しできることを確認済み）。

Vercel は main へのマージ直後に新しいコードを公開するため、**PR をマージする前に** Turso へ反映する。

1. バックアップ：BookNest の 設定 → データ管理 →「すべてのデータ（JSON）」をダウンロードしておく
2. 反映：PC のターミナルで `npm run cloud:setup`（未適用の migration だけが流れる）
3. 確認：「✓ テーブルを作成・更新しました: 20261007000000_creative_knowledge」と表示されること
4. PR をマージ（Vercel が自動で公開）

### 取り消し（緊急時）

`prisma/migrations/20261007000000_creative_knowledge/down.sql` を Turso のシェル（`turso db shell <DB名>`）で実行する。消えるのは創作知識のデータだけで、既存の本・フレーズ・知識・創作のデータには影響しない。その後、ひとつ前のコードに戻す（Vercel の Deployments から以前のデプロイを Promote）。
