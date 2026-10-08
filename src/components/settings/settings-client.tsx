"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { Download, FileJson, FileSpreadsheet, Loader2, Monitor, Moon, Sun, Upload, Trash2, Database, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect, Switch } from "@/components/ui/form-controls";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/primitives";
import { Dialog, DialogContent } from "@/components/ui/overlays";
import { InstallButton } from "@/components/pwa/install-button";
import {
  deleteAllDataAction,
  deleteSampleAction,
  loadSampleAction,
  previewImportAction,
  runImportAction,
  updateProfileAction,
  updateSettingsAction,
  fillCoversAction,
  syncSheetsNowAction,
  testSheetsAction,
} from "@/server/actions/settings";
import type { AppSettings } from "@/server/services/settings";
import { cn } from "@/lib/utils";

const TABLE_LABEL: Record<string, string> = {
  book: "本",
  author: "著者",
  tag: "タグ",
  series: "シリーズ",
  customShelf: "マイ本棚",
  readingRecord: "読書記録",
  readingSession: "読書メモ・進捗",
  readingGoal: "読書目標",
  quote: "フレーズ",
  knowledgeNote: "知識",
  readingPath: "読書ルート",
  creativeNote: "創作メモ",
  creativeKnowledge: "創作知識",
  creativeKnowledgeRelation: "創作知識のつながり",
  creativeKnowledgeReference: "創作知識の参考読書",
  creativeKnowledgeSource: "創作知識の出典",
  creativeNoteTag: "創作メモのタグ",
  novelProject: "作品",
  character: "人物",
  characterRelationship: "人物の関係",
  worldSetting: "世界観",
  plot: "プロット",
  chapter: "章",
  scene: "シーン",
  creativeLink: "読書と創作の紐付け",
  aIConversation: "AI会話",
  aIMessage: "AIメッセージ",
};

export function ProfileCard({ name }: { name: string }) {
  const router = useRouter();
  const [v, setV] = useState(name);
  const [pending, start] = useTransition();
  return (
    <Card>
      <CardHeader>
        <CardTitle>👤 プロフィール</CardTitle>
      </CardHeader>
      <CardContent>
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await updateProfileAction({ name: v });
              if (!res.ok) return void toast.error(res.error);
              toast.success("保存しました");
              router.refresh();
            });
          }}
        >
          <Field label="ニックネーム（ホームのあいさつに表示）" htmlFor="u-name" className="flex-1">
            <Input id="u-name" value={v} onChange={(e) => setV(e.target.value)} maxLength={40} />
          </Field>
          <Button type="submit" disabled={pending}>
            保存
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function ThemeCard() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => queueMicrotask(() => setMounted(true)), []);
  const options = [
    { key: "system", label: "端末に合わせる", icon: Monitor },
    { key: "light", label: "ライト", icon: Sun },
    { key: "dark", label: "ダーク", icon: Moon },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>🎨 テーマ</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="テーマ">
          {options.map((o) => (
            <button
              key={o.key}
              type="button"
              role="radio"
              aria-checked={mounted && theme === o.key}
              onClick={() => setTheme(o.key)}
              className={cn(
                "flex h-16 flex-col items-center justify-center gap-1 rounded-xl border text-xs",
                mounted && theme === o.key ? "border-primary bg-primary/10 font-semibold text-primary" : "bg-card",
              )}
            >
              <o.icon className="size-5" />
              {o.label}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function PwaCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>📱 アプリとして使う（PWA）</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">ホーム画面に追加すると、ブラウザのバーが消えてアプリのように起動します。一度開いたページはオフラインでも閲覧できます。</p>
        <InstallButton />
      </CardContent>
    </Card>
  );
}

export function DataCard({ hasSample }: { hasSample: boolean }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ text: string; exportedAt: string; counts: Record<string, { total: number; duplicate: number }> } | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [pending, start] = useTransition();

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return void toast.error("ファイルが大きすぎます（10MBまで）");
    const text = await file.text();
    start(async () => {
      const res = await previewImportAction(text);
      if (fileRef.current) fileRef.current.value = "";
      if (!res.ok) return void toast.error(res.error);
      setPreview({ text, ...res.data });
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <Database className="size-5 text-primary" /> データ管理
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">バックアップ・エクスポート</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <Button asChild variant="outline" className="justify-start">
              <a href="/api/export?format=xlsx" download>
                <FileSpreadsheet /> すべてのデータ（Excel）
              </a>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <a href="/api/export?format=json" download>
                <FileJson /> すべてのデータ（JSON）
              </a>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <a href="/api/export?format=csv&type=books" download>
                <FileSpreadsheet /> 本（CSV）
              </a>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <a href="/api/export?format=csv&type=records" download>
                <FileSpreadsheet /> 読書記録（CSV）
              </a>
            </Button>
            <Button asChild variant="outline" className="justify-start">
              <a href="/api/export?format=csv&type=quotes" download>
                <FileSpreadsheet /> フレーズ（CSV）
              </a>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Excel は種類ごとにシートを分けた表で、Excel・Google スプレッドシート（ドライブにアップロードして開く、または「ファイル → インポート」）・Numbers で開けます。
            JSON はアプリに読み込み直せる完全なバックアップです。どちらも本・読書記録・読書メモ・フレーズ・知識・本棚・読書目標・読書ルート・創作（メモ・作品・人物など）を含みます。画像ファイルは含まれません。
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">インポート</h3>
          <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} aria-label="バックアップファイルを選択" />
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={pending}>
            {pending ? <Loader2 className="animate-spin" /> : <Upload />} JSON バックアップを読み込む
          </Button>
          <p className="text-xs text-muted-foreground">取り込む前に内容を確認できます。同じ本（ISBN）・著者・タグなどは重複して登録されません。</p>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">サンプルデータ</h3>
          <div className="flex flex-wrap gap-2">
            {hasSample ? (
              <Button
                variant="outline"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await deleteSampleAction();
                    if (!res.ok) return void toast.error(res.error);
                    toast.success("サンプルデータを削除しました");
                    router.refresh();
                  })
                }
              >
                <Trash2 /> サンプルデータを削除
              </Button>
            ) : (
              <Button
                variant="outline"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await loadSampleAction();
                    if (!res.ok) return void toast.error(res.error);
                    toast.success("サンプルデータを追加しました");
                    router.refresh();
                  })
                }
              >
                <Sparkles /> サンプルデータを追加
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">サンプルデータには目印が付いており、自分で登録したデータには影響しません。</p>
        </section>

        <section className="space-y-2 rounded-xl border border-destructive/40 p-3">
          <h3 className="text-sm font-semibold text-destructive">すべてのデータを削除</h3>
          <p className="text-xs text-muted-foreground">本・読書記録・フレーズ・知識などをすべて削除します。実行前にバックアップを取ってください。</p>
          <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
            <Trash2 /> すべて削除…
          </Button>
        </section>
      </CardContent>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent title="インポートの確認" description={preview ? `バックアップ作成日時：${new Date(preview.exportedAt).toLocaleString("ja-JP")}` : undefined}>
          {preview ? (
            <div className="space-y-4">
              <table className="w-full text-sm tabular-nums">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="py-1 font-normal">種類</th>
                    <th className="py-1 text-right font-normal">件数</th>
                    <th className="py-1 text-right font-normal">うち既存と重複</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(preview.counts)
                    .filter(([, c]) => c.total)
                    .map(([k, c]) => (
                      <tr key={k} className="border-t">
                        <td className="py-1.5">{TABLE_LABEL[k] ?? k}</td>
                        <td className="py-1.5 text-right">{c.total}</td>
                        <td className="py-1.5 text-right">{c.duplicate}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
              <p className="text-xs text-muted-foreground">重複しているデータは既存のものに統合され、上書きはされません。新しいデータのみ追加されます。</p>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => setPreview(null)}>
                  キャンセル
                </Button>
                <Button
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      const res = await runImportAction(preview.text);
                      if (!res.ok) return void toast.error(res.error);
                      const n = Object.values(res.data).reduce((a, b) => a + b, 0);
                      toast.success(`${n}件のデータを取り込みました`);
                      setPreview(null);
                      router.refresh();
                    })
                  }
                >
                  {pending ? <Loader2 className="animate-spin" /> : <Download />} 取り込む
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent title="すべてのデータを削除しますか？" description="この操作は取り消せません。確認のため「削除」と入力してください。">
          <div className="space-y-3">
            <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} aria-label="確認入力" placeholder="削除" />
            <Button
              variant="destructive"
              className="w-full"
              disabled={pending || confirmText !== "削除"}
              onClick={() =>
                start(async () => {
                  const res = await deleteAllDataAction(confirmText);
                  if (!res.ok) return void toast.error(res.error);
                  toast.success("すべてのデータを削除しました");
                  setDeleteOpen(false);
                  setConfirmText("");
                  router.refresh();
                })
              }
            >
              すべて削除する
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export function AiCard({ settings, configured, model, providerLabel }: { settings: AppSettings; configured: boolean; model: string; providerLabel: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Card>
      <CardHeader>
        <CardTitle>🤖 AI設定</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-xl bg-muted/60 p-3 text-sm">
          {configured ? (
            <p>
              AIプロバイダ：<span className="font-medium">{providerLabel}</span>・モデル <code className="rounded bg-background px-1">{model}</code> が設定されています。
            </p>
          ) : (
            <p>
              AIプロバイダが未設定です。<code className="rounded bg-background px-1">.env</code> に <code className="rounded bg-background px-1">AI_API_KEY</code> を設定するとAI司書の回答生成が使えます。未設定でも、アプリ内データの検索結果は表示されます。
            </p>
          )}
        </div>
        <label className="flex items-start justify-between gap-4">
          <span className="text-sm">
            <span className="font-medium">AI機能を使う</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">オンにすると、質問に関係する本・感想・フレーズ・知識の一部がAIプロバイダに送信されます。</span>
          </span>
          <Switch
            checked={settings.aiEnabled}
            disabled={pending || !configured}
            onCheckedChange={(c) =>
              start(async () => {
                const res = await updateSettingsAction({ aiEnabled: c });
                if (!res.ok) return void toast.error(res.error);
                toast.success(c ? "AI機能をオンにしました" : "AI機能をオフにしました");
                router.refresh();
              })
            }
            aria-label="AI機能を使う"
          />
        </label>
        <label className="flex items-start justify-between gap-4 border-t pt-4">
          <span className="text-sm">
            <span className="font-medium">本日のニュースで、知識に関係するニュースを探す</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">オンにすると、知識のタイトルの一部（例：データセンター）が Google ニュースの検索語として送られます。オフにすると主要ニュースだけを集めます。</span>
          </span>
          <Switch
            checked={settings.newsKnowledgeSearch}
            disabled={pending}
            onCheckedChange={(c) =>
              start(async () => {
                const res = await updateSettingsAction({ newsKnowledgeSearch: c });
                if (!res.ok) return void toast.error(res.error);
                toast.success(c ? "知識に関係するニュースを探します（次の更新から反映）" : "主要ニュースだけを集めます（次の更新から反映）");
                router.refresh();
              })
            }
            aria-label="本日のニュースで、知識に関係するニュースを探す"
          />
        </label>
      </CardContent>
    </Card>
  );
}

export function OcrCard({ serverAvailable }: { serverAvailable: boolean }) {
  const [engine, setEngine] = useState("tesseract");
  useEffect(() => {
    try {
      const v = localStorage.getItem("booknest.ocrEngine");
      if (v) queueMicrotask(() => setEngine(v));
    } catch {
      /* noop */
    }
  }, []);
  return (
    <Card>
      <CardHeader>
        <CardTitle>🔍 OCR設定</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Field label="文字認識エンジン" htmlFor="ocr-engine">
          <NativeSelect
            id="ocr-engine"
            value={engine}
            onChange={(e) => {
              setEngine(e.target.value);
              try {
                localStorage.setItem("booknest.ocrEngine", e.target.value);
              } catch {
                /* noop */
              }
              toast.success("OCRエンジンを変更しました");
            }}
          >
            <option value="tesseract">端末内で処理（Tesseract・画像は外部送信されません）</option>
            <option value="server" disabled={!serverAvailable}>
              サーバーOCR（Google Cloud Vision）{serverAvailable ? "" : "：未設定"}
            </option>
          </NativeSelect>
        </Field>
        <p className="text-xs text-muted-foreground">
          端末内処理は初回のみ日本語の認識データ（約10MB）をダウンロードし、以降は端末に保存されます。縦書き・横書きの両方に対応しています。
        </p>
      </CardContent>
    </Card>
  );
}

export function SheetsCard({ configured }: { configured: boolean }) {
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<"test" | "sync" | null>(null);
  const run = (kind: "test" | "sync") =>
    start(async () => {
      setBusy(kind);
      try {
        if (kind === "test") {
          const res = await testSheetsAction();
          if (!res.ok) return void toast.error(res.error);
          toast.success("スプレッドシートに接続できました");
        } else {
          const res = await syncSheetsNowAction();
          if (!res.ok) return void toast.error(res.error);
          toast.success(`書き出しました（フレーズ ${res.data.quote}件・知識 ${res.data.knowledge}件・創作メモ ${res.data.note}件）`);
        }
      } finally {
        setBusy(null);
      }
    });
  return (
    <Card>
      <CardHeader>
        <CardTitle>📊 スプレッドシート連携</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-xl bg-muted/60 p-3 text-sm">
          {configured ? (
            <p>
              <span className="font-medium">自動反映：オン</span>
              。フレーズ・知識・創作メモを保存・削除すると、Googleスプレッドシートの「フレーズ」「知識」「創作メモ」シートに自動で反映されます。
            </p>
          ) : (
            <p>
              未設定です。<code className="rounded bg-background px-1">SHEETS_WEBHOOK_URL</code> と <code className="rounded bg-background px-1">SHEETS_WEBHOOK_SECRET</code> を設定すると、フレーズ・知識・創作メモが自動でスプレッドシートに反映されます（手順は docs/sheets-sync.md）。
            </p>
          )}
        </div>
        {configured ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" disabled={pending} onClick={() => run("test")}>
              {busy === "test" ? <Loader2 className="size-4 animate-spin" /> : null}
              接続テスト
            </Button>
            <Button disabled={pending} onClick={() => run("sync")}>
              {busy === "sync" ? <Loader2 className="size-4 animate-spin" /> : null}
              全件を書き出す
            </Button>
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">「全件を書き出す」は3つのシートを今のデータで書き直します。初回や、本のタイトル変更・インポートの後に使ってください。</p>
      </CardContent>
    </Card>
  );
}

export function CoversCard({ missing, rakuten }: { missing: number; rakuten: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [progress, setProgress] = useState<{ found: number; tried: number; total: number } | null>(null);
  const fill = () =>
    start(async () => {
      const skip: string[] = [];
      let found = 0;
      setProgress({ found: 0, tried: 0, total: missing });
      // サーバーの実行時間制限を避けるため、数冊ずつ繰り返す
      for (let i = 0; i < 100; i++) {
        const res = await fillCoversAction(skip);
        if (!res.ok) {
          toast.error(res.error);
          break;
        }
        found += res.data.found;
        skip.push(...res.data.notFoundIds);
        setProgress({ found, tried: found + skip.length, total: missing });
        if (!res.data.processed || !res.data.remaining) break;
      }
      toast.success(found ? `${found}冊の表紙を取得しました` : "新しく見つかった表紙はありませんでした");
      setProgress(null);
      router.refresh();
    });
  return (
    <Card>
      <CardHeader>
        <CardTitle>🖼️ 表紙画像</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">
          表紙のない本（ISBNあり）：<span className="font-medium">{missing}冊</span>
        </p>
        <p className="text-xs text-muted-foreground">
          {rakuten ? "楽天ブックス" : "（楽天ブックスAPIは未設定）"}・openBD・国立国会図書館・Google Books の順に表紙を探します。
          {rakuten ? "" : " RAKUTEN_APP_ID と RAKUTEN_ACCESS_KEY を設定すると、日本の本の表紙がほぼ取れるようになります。"}
        </p>
        <Button disabled={pending || missing === 0} onClick={fill}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          {progress ? `探しています… ${progress.tried}/${progress.total}冊` : "表紙を一括取得"}
        </Button>
      </CardContent>
    </Card>
  );
}
