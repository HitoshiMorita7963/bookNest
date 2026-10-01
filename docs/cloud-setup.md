# BookNest をインターネット上に置く（スマホだけで使う）手順

PC を起動していなくても、スマホからいつでも BookNest を使えるようにする手順です。
すべて **無料プラン** で動きます（個人で使う範囲なら費用はかかりません）。

| 役割 | 使うサービス | 料金 |
| --- | --- | --- |
| アプリ本体 | Vercel（ヴァーセル） | 無料（Hobby プラン） |
| データベース | Turso（ターソ） | 無料プラン |
| 画像の保存 | Vercel Blob | 無料枠 |

所要時間：30分ほど

---

## 0. 準備：プルリクエストをマージする

1. https://github.com/HitoshiMorita7963/bookNest/pulls を開きます。
2. BookNest のプルリクエストを開き、下の **「Merge pull request」→「Confirm merge」** を押します。

これで `main` ブランチに BookNest のプログラムが入ります（Vercel は `main` を公開します）。

---

## 1. Turso でデータベースを作る

1. https://turso.tech を開き、「Sign up」→ **GitHub アカウントでログイン** します。
2. ダッシュボードで **「Create Database」** を押します。
   - 名前：`booknest`
   - 場所（Location）：**Tokyo（東京）** を選ぶと速くなります。
3. 作成したデータベースを開き、次の2つを控えます。
   - **Database URL**（`libsql://booknest-xxxx.turso.io` のような文字列）
   - **「Create Token」/「Generate Token」** を押して表示される **トークン**（長い文字列）

   トークンはパスワードと同じです。他の人に見せないでください。

4. PC の `bookNest` フォルダにある **`.env`** をメモ帳で開き、次の2行に貼り付けて保存します。

   ```
   TURSO_DATABASE_URL=libsql://booknest-xxxx.turso.io
   TURSO_AUTH_TOKEN=（控えたトークン）
   ```

5. ここまでできたら Claude に「Tursoを設定した」と伝えてください。
   クラウドのデータベースにテーブルを作り、PC に入っているデータをコピーします。
   （自分で行う場合は `npm run cloud:setup`、データのコピーは `npm run cloud:copy`）

> `.env` に Turso を設定すると、PC で起動した BookNest もクラウドのデータを使うようになります。
> PC とスマホで同じデータを見られます。

---

## 2. Vercel にアプリを公開する

1. https://vercel.com を開き、「Sign Up」→ **「Continue with GitHub」** でログインします（Hobby プランを選択）。
2. **「Add New…」→「Project」** を押し、一覧から **`bookNest`** の「Import」を押します。
3. **「Environment Variables」** を開き、次を1つずつ追加します（左に名前、右に値）。

   | 名前 | 値 | 必須 |
   | --- | --- | --- |
   | `APP_PASSWORD` | ログイン用のパスワード（自分で決める。長めに） | ✅ |
   | `TURSO_DATABASE_URL` | 手順1で控えた Database URL | ✅ |
   | `TURSO_AUTH_TOKEN` | 手順1で控えたトークン | ✅ |
   | `GOOGLE_BOOKS_API_KEY` | `.env` と同じ値 | 任意 |
   | `OCR_PROVIDER` | `google-vision`（Google の OCR を使う場合） | 任意 |
   | `OCR_API_KEY` | `.env` と同じ値 | 任意 |
   | `AI_PROVIDER` | `openai`（ChatGPT）または `anthropic`（Claude） | 任意 |
   | `AI_API_KEY` | 選んだプロバイダの API キー（AI 司書を使う場合） | 任意 |
   | `AI_MODEL` | モデルID（例：`gpt-6-luna`） | 任意 |
   | `RAKUTEN_APP_ID` / `RAKUTEN_ACCESS_KEY` | 楽天ブックスAPI（表紙画像の取得） | 任意 |
   | `SHEETS_WEBHOOK_URL` / `SHEETS_WEBHOOK_SECRET` | スプレッドシート自動反映（[手順](sheets-sync.md)） | 任意 |
   | `APP_URL` | 公開URL（例：`https://booknest-xxxx.vercel.app`） | 任意 |

4. **「Deploy」** を押します。2〜3分で完了し、`https://booknest-xxxx.vercel.app` のようなアドレスができます。

---

## 3. 画像の保存先（Vercel Blob）をつなぐ

本の表紙やフレーズの撮影画像を保存するために必要です。

1. Vercel のプロジェクト画面で **「Storage」** タブを開きます。
2. **「Create Database」（または「Create」）→「Blob」** を選びます。
   - アクセス設定を選べる場合は **Private（非公開）** を選びます。
3. 作成後、**「Connect Project」** で `bookNest` に接続します（`BLOB_READ_WRITE_TOKEN` が自動で設定されます）。
4. **「Deployments」タブ → 一番上の「…」→「Redeploy」** を押して、設定を反映します。

---

## 4. スマホで使う

1. スマホのブラウザで `https://booknest-xxxx.vercel.app` を開きます。
2. 手順2で決めたパスワードでログインします（180日間はログインしたままになります）。
3. ホーム画面に追加します。
   - **iPhone**：Safari の共有ボタン（□に↑）→「ホーム画面に追加」
   - **Android**：Chrome のメニュー（︙）→「アプリをインストール」
4. ホーム画面の BookNest アイコンから、アプリとして起動できます。

PC からも同じアドレスを開けば、同じデータを見られます。

---

## よくある質問

**Q. お金はかかりますか？**
個人で使う範囲なら、どのサービスも無料プランに収まります。上限を超えそうな場合は、各サービスからメールで知らせが来ます。

**Q. 他の人に見られませんか？**
アドレスを知られても、パスワードが無いと中身は見られません。撮影したフレーズ画像も、ログインしないと表示できない設定です。パスワードは推測されにくいものにしてください。

**Q. プログラムを更新したら？**
GitHub の `main` に反映されると、Vercel が自動で公開し直します。

**Q. データのバックアップは？**
アプリの「設定 → データ管理」から、いつでも JSON / CSV で書き出せます。月に一度くらい保存しておくと安心です。

**Q. PC にアップロードした画像は？**
自分で撮影・アップロードした画像（表紙・フレーズの元画像）はコピーされません。書影（ネットから取得した表紙）や文字のデータはすべてコピーされます。
