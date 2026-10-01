# 📚 BookNest

**読書によって形成されていく自分の知識と記憶を管理する、スマートフォン中心の個人用 読書管理 PWA**

本を登録するためだけのアプリではなく、読んでいる最中に自然に開き、気になった文章を撮影して残し、読後に学んだことを知識として蓄積し、AI 司書に問いかけられる——そんな「本 → 読書 → フレーズ → 感想 → 知識 → 関連する本 → 次の本」の循環を作ることを目指しています。

## 主な機能

| 領域 | 機能 |
| --- | --- |
| 本 | ISBN 検索（openBD → 国立国会図書館 → Google Books）、カメラでの ISBN バーコード読み取り、タイトル検索、手入力、編集・削除、書影（URL / 画像アップロード）、重複登録の防止 |
| 読書 | 読みたい / 積読 / 読書中 / 読了 / 中断 / 読了断念、読書開始日・読了日、ページ進捗、読書時間、読書メモ、評価・感想・要約・学んだこと・印象に残ったこと・疑問点、再読履歴 |
| 本棚 | グリッド / リスト表示、マイ本棚（1冊を複数の本棚へ）、タグ、検索、フィルター（ステータス・評価・ジャンル・タグ・著者・出版年・読了年・ページ数）、並び替え、積読ページ（積読期間フィルター・ランダムに1冊） |
| 横断検索 | タイトル・著者・ISBN・出版社・タグ・感想・要約・学んだこと・読書メモ・フレーズ・知識 |
| 統計 | 月別 / 年間の冊数・ページ数、ジャンル別、評価分布、平均読了日数・平均ページ数、読書カレンダー（ヒートマップ・日付タップで記録表示）、連続読書日数 |
| 目標 | 年間冊数・年間ページ数・月間冊数・ジャンル別冊数、ペースとの比較 |
| 著者・シリーズ | 著者ページ（読了数・平均評価・作品・保存フレーズ）、シリーズの巻一覧と未読・未登録巻の表示 |
| フレーズ | カメラ撮影 / 写真選択 → トリミング → OCR（日本語の横書き・縦書き）→ 修正 → 本・ページ・タグ・自分のメモ → 保存、再 OCR、元画像の保存、検索、お気に入り |
| 知識 | 知識ノート（フレーズとは別の「自分の理解」）、タグ・カテゴリ、本・フレーズとの関連付け、知識同士のリンク、知識マップ |
| 読書ルート | 読む順番のコース、進捗、次に読む本 |
| 振り返り | 次に読む本の推薦（ルールベース）、読書傾向分析、「私の読書人生」 |
| AI | AI 司書（アプリ内データを検索して回答・出典表示・会話履歴）、読書メモ整理、フレーズ分析、読書傾向のまとめ。生成内容はすべて「AI 提案」として確認してから保存 |
| PWA | ホーム画面へのインストール、スタンドアロン起動、Safe Area 対応、一度開いたページのオフライン閲覧 |
| データ | JSON バックアップ / インポート（重複処理つき）、CSV エクスポート（本・読書記録・フレーズ）、サンプルデータの追加・削除 |

## 技術スタック

- **Next.js 16**（App Router / Server Components / Server Actions）+ **React 19** + **TypeScript**
- **Tailwind CSS v4** + shadcn/ui 方式のコンポーネント（Radix UI / vaul）+ **Lucide React**
- **Prisma 6** + **SQLite**
- **Zod 4** + **React Hook Form**
- **Recharts**、**date-fns**
- **tesseract.js**（端末内 OCR）、**@zxing/browser**（バーコード）、**sharp**（画像の検証・圧縮）
- **@anthropic-ai/sdk**（AI 司書）
- テスト：**Vitest**（ユニット）、**Playwright**（E2E）

## セットアップ

必要環境：Node.js 20.19 以上（開発は Node.js 24 で確認）

```bash
npm install
```

```bash
cp .env.example .env
```

```bash
npx prisma migrate deploy
```

```bash
npm run db:seed
```

```bash
npm run dev
```

ブラウザで http://localhost:3000 を開きます。スマートフォン実機で試す場合は、同じネットワークから `http://<PCのIPアドレス>:3000` にアクセスしてください（カメラや PWA のインストールには HTTPS が必要です。下記「PWA について」参照）。

> `npm install` 時に Prisma Client が自動生成されます（`postinstall`）。サンプルデータが不要な場合は `db:seed` を省略するか、設定画面の「サンプルデータを削除」を使ってください。

## 環境変数

`.env.example` に一覧があります。実際の秘密情報は `.env` に書き、Git には含めません（`.gitignore` 済み）。

| 変数 | 必須 | 説明 |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | SQLite の場所。既定 `file:../data/booknest.db`（`prisma/` からの相対パス） |
| `GOOGLE_BOOKS_API_KEY` | | Google Books API キー（任意。未設定でも動作しますが回数制限が厳しくなります） |
| `AI_PROVIDER` | | `anthropic` または `none`。未設定時はキーがあれば `anthropic` |
| `AI_API_KEY` | | Anthropic API キー。未設定の場合、AI 司書は「検索モード」で動作します |
| `APP_PASSWORD` | クラウドでは✅ | ログイン用パスワード。設定するとログインが必要になります |
| `AUTH_SECRET` | | セッション署名用のランダムな文字列（任意） |
| `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` | クラウドでは✅ | クラウドの DB（Turso）。設定するとローカルの SQLite の代わりに使います |
| `BLOB_READ_WRITE_TOKEN` | クラウドでは✅ | 画像の保存先（Vercel Blob）。Vercel で Blob を接続すると自動設定 |
| `AI_MODEL` | | 使用モデル（既定 `claude-opus-5`） |
| `OCR_PROVIDER` | | `tesseract`（既定・端末内処理）または `google-vision` |
| `OCR_API_KEY` | | `google-vision` 使用時の Google Cloud Vision API キー |
| `MAX_UPLOAD_MB` | | アップロード画像の最大サイズ（既定 10） |

## データベース

- スキーマ：`prisma/schema.prisma`（Book / Author / Series / Tag / ReadingRecord / ReadingSession / CustomShelf / ReadingGoal / Quote / KnowledgeNote / KnowledgeLink / ReadingPath / AIConversation / AIMessage など）
- 同じ本を何度も読めるよう、読書記録（ReadingRecord）は本（Book）とは別に保存します。日々の進捗やメモは ReadingSession として保存され、読書カレンダーの元データになります。
- データは `data/booknest.db`、アップロード画像は `data/uploads/` に保存されます（どちらも Git 管理外）。

| コマンド | 内容 |
| --- | --- |
| `npx prisma migrate deploy` | マイグレーションを適用 |
| `npx prisma migrate dev --name <名前>` | スキーマ変更時に新しいマイグレーションを作成 |
| `npm run db:seed` | サンプルデータ（16冊・フレーズ・知識・本棚・読書ルート）を投入 |
| `npm run db:reset` | DB を初期化してサンプルデータを投入（全データ削除） |
| `npm run db:studio` | Prisma Studio でデータを閲覧 |

## 起動・ビルド

```bash
npm run dev
```

```bash
npm run build
```

```bash
npm run start
```

## スマホだけで使う（クラウドに公開）

PC を起動していなくてもスマホから使えるよう、無料のクラウドサービス（Vercel + Turso + Vercel Blob）に公開できます。
手順は **[docs/cloud-setup.md](docs/cloud-setup.md)** を参照してください。

- `TURSO_DATABASE_URL` を設定すると、DB がローカルの SQLite ファイルからクラウドの Turso（libSQL）に切り替わります。
- `APP_PASSWORD` を設定するとパスワードログインが有効になります（クラウド公開時は必須）。
- `BLOB_READ_WRITE_TOKEN` を設定すると、アップロード画像の保存先が Vercel Blob（非公開）になります。
- `npm run cloud:setup` で Turso にテーブルを作成、`npm run cloud:copy` で PC のデータを Turso にコピーします。

## PWA について

- `src/app/manifest.ts`（Web App Manifest）、`public/icons/`（192 / 512 / maskable / Apple Touch Icon）、`public/sw.js`（Service Worker）で構成しています。アイコンは `npx tsx scripts/generate-icons.ts` で再生成できます。
- Service Worker は本番ビルド（`npm run start`）でのみ登録されます。
- キャッシュ戦略：静的ファイルとアップロード画像は Cache First、書影は Stale While Revalidate、ページは Network First（失敗時はキャッシュ → オフラインページ）。本棚・本の詳細・読書記録・フレーズなど、一度開いたページはオフラインでも閲覧できます。
- スマートフォンにインストールするには HTTPS が必要です（`localhost` は例外）。自宅サーバーで運用する場合は、リバースプロキシ（Caddy など）や Tailscale などで HTTPS を用意してください。
- iPhone は Safari の共有ボタン →「ホーム画面に追加」、Android / PC は設定画面の「ホーム画面にインストール」から追加できます。

## OCR について

- 既定では **tesseract.js** によりブラウザ内（端末内）で文字認識を行います。**画像は外部に送信されません**。初回のみ日本語の学習データ（横書き `jpn` / 縦書き `jpn_vert`）を CDN からダウンロードし、以降は端末にキャッシュされます。
- 流れ：撮影 / 写真選択 → 指でトリミング → 回転 → 向き（自動 / 横書き / 縦書き）→ 前処理（拡大・グレースケール・コントラスト補正）→ OCR → 日本語の後処理（文字間の空白除去、段落内改行の整理、全角英数字の半角化）→ 確認・修正 → 保存。
- 「自動」は投影プロファイル（空白行と空白列の比率）で向きを推定し、信頼度が低い場合はもう一方の向きでも読み取って良い方を採用します。結果画面から「再 OCR」「縦書き / 横書きで再 OCR」ができます。
- 構成：`src/lib/ocr/ocr-service.ts`（OCRService：エンジン切替）、`src/lib/ocr/preprocess.ts`（ImagePreprocessService）、`src/server/services/quotes.ts`（QuoteService）。`OcrEngine` を実装すれば別のエンジンを追加できます。サーバー OCR（Google Cloud Vision）は `OCR_PROVIDER=google-vision` と `OCR_API_KEY` を設定すると選択できます。
- 動作確認用スクリプト：`npx tsx --tsconfig tsconfig.json scripts/try-ocr.ts`

## ISBN 検索について

- `src/server/services/metadata.ts` の **BookMetadataService** がプロバイダを順に問い合わせ、欠けている項目を補完し合います：openBD（日本の書籍に強い・キー不要）→ 国立国会図書館サーチ（キー不要）→ Google Books（キー任意）。
- 取得項目：タイトル・よみ・著者・出版社・発売日・ページ数・書影・ISBN-10/13・内容紹介・シリーズ。ISBN はチェックディジットを検証し、10 桁 / 13 桁を相互変換します。
- すべてのプロバイダで見つからない・通信に失敗した場合も、そのまま手動で登録できます。
- バーコード：ブラウザ標準の BarcodeDetector（Android Chrome など）→ 非対応ブラウザ（iOS Safari など）では ZXing → カメラが使えない場合は「写真から読み取る」へフォールバックします。
- 動作確認用スクリプト：`npx tsx --tsconfig tsconfig.json scripts/try-isbn.ts 9784101010014`

## AI 機能について

- **プロバイダの抽象化**：`src/server/ai/provider.ts` の `AiProvider` インターフェース。現在は Anthropic（Claude）を実装しています。API キーは環境変数からのみ読み込みます。
- **プライバシー**：AI 機能は既定でオフです。`.env` に `AI_API_KEY` を設定し、さらに設定画面で「AI 機能を使う」をオンにした場合のみ、質問に関係する本・感想・フレーズ・知識の一部が AI プロバイダに送信されます。
- **AI 司書**（`/ai`）：Claude がアプリ内データを検索するツール（横断検索・本の一覧/詳細・フレーズ・知識・読書傾向・次に読む候補）を使って回答します。回答には「参考にした本・フレーズ・知識」を表示します（AI が示した出典のうち、実際にツールが返したデータだけを表示）。データから分かることと推測を区別し、ユーザーの考えを断定しないよう指示しています。会話は保存され、後から見返せます。
- **AI が使えない場合**は「検索モード」として、質問からキーワード・期間を抽出したアプリ内検索の結果を表示します。
- **AI 読書メモ整理**（読了・読書記録の編集画面）：書いた文章を要約・学んだこと・印象に残った点・疑問点・キーワードに整理。文章に無い事実は追加しないよう指示し、提案を確認してから反映します。
- **AI フレーズ分析**（フレーズ詳細）：テーマ・追加タグ・関連する知識・似た過去のフレーズ・知識ノート案を「AI 提案」として表示し、選んだものだけ保存します。
- **AI 読書傾向のまとめ**（読書傾向ページ）：集計データにもとづいて、断定しすぎない表現で文章化します。
- 既定モデルは `claude-opus-5`。安全性の判断で回答が拒否された場合に備え、サーバー側フォールバック（`fallbacks: "default"`）を有効にしています。

## テスト

```bash
npm test
```

ユニットテスト（Vitest・48件）：本（作成・編集・削除・検索・重複）、読書（開始・進捗・読了・再読・記録の再計算）、フレーズ（OCR 後処理・保存・編集・検索・本との紐付け）、知識（作成・編集・検索・本との関連・リンク）、本棚（作成・追加・削除）、統計（読了数・ページ数・評価・再読）、目標、読書ルート、推薦、バックアップ（往復・重複処理）、AI 司書（検索モード・ツール）。テスト専用の SQLite（`tests/.tmp/`）を使います。

```bash
npm run build
```

```bash
npm run test:e2e
```

E2E テスト（Playwright・14件。`E2E_MODE=cloud` でクラウド構成〈Turso アダプタ＋ログイン〉の16件）：本番ビルドを専用 DB で起動し、スマートフォン幅（390px）で「アプリ起動 → 本を追加 → 本棚 → 本詳細 → 読書開始 → 進捗更新 → フレーズ保存 → 読了 → 統計確認」を通しで確認します。あわせて 375 / 390 / 414 / 430 / 768 / 1024 / 1440px の各幅で主要 22 画面に横スクロールが無いこと、ナビゲーションの切替、タップ領域（44px 以上）、PWA（マニフェスト・Service Worker）、不正な画像アップロードの拒否を確認します。初回は `npx playwright install chromium` が必要です。

その他：`npm run lint`、`npm run typecheck`

## セキュリティ

- API キーは `.env` のみ（Git 管理外）。ソースコードには含めません。
- 入力はすべてサーバー側で Zod により検証。DB アクセスは Prisma（パラメータ化クエリ）。
- React の自動エスケープに加え、AI の回答表示も HTML を挿入しない独自レンダラーで描画。
- 画像アップロード：MIME タイプ・サイズ制限、sharp による実デコード検証（偽装ファイルの拒否）、リサイズ・WebP 圧縮、推測不能なファイル名、配信時のパス検証。
- セキュリティヘッダー（`X-Content-Type-Options`、`X-Frame-Options`、`Referrer-Policy`、`Permissions-Policy`）。
- `APP_PASSWORD` を設定するとパスワードログインが有効になります（HMAC 署名付き Cookie、180日間有効、失敗時は遅延）。クラウドに公開する場合は必ず設定してください。PC 内だけで使う場合は未設定でも構いません。

## ディレクトリ構成

```
prisma/              スキーマ・マイグレーション・シード
public/              アイコン・Service Worker
src/app/(app)/       画面（ホーム・本棚・本・読書中・積読・検索・フレーズ・知識・統計・目標・著者・シリーズ・読書ルート・AI司書・設定 など）
src/app/api/         画像アップロード/配信・エクスポート・OCR
src/components/      UI コンポーネント（ui/ は shadcn/ui 方式の基本部品）
src/lib/             ユーティリティ・定数・バリデーション・ISBN・OCR（クライアント）
src/server/services/ ドメインロジック（本・読書・フレーズ・知識・統計・目標・推薦・バックアップ など）
src/server/actions/  Server Actions（画面からの操作）
src/server/ai/       AI プロバイダ・ツール・AI 司書
tests/unit/          ユニットテスト（Vitest）
tests/e2e/           E2E テスト（Playwright）
scripts/             アイコン生成・ISBN/OCR の動作確認
```

## 今後の拡張のアイデア

- 完全なオフライン編集（IndexedDB にキューイングして再接続時に同期）
- 楽天ブックス API など、書誌情報プロバイダの追加
- 知識マップの自動レイアウト改善（クラスタリング）
- フレーズ画像からの複数フレーズ一括取り込み
