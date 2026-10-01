"use client";

/**
 * フレーズ保存フロー
 *   撮影 / 写真選択 → トリミング → OCR → 確認・修正 → 本・ページ・タグ・メモ → 保存
 */
import { useCallback, useEffect, useRef, useState } from "react";
import ReactCrop, { type PercentCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";
import { toast } from "sonner";
import { Camera, ImageIcon, Keyboard, Loader2, RotateCcw, RotateCw, ScanText, RefreshCw, ArrowLeft, Crop as CropIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/form-controls";
import { cn } from "@/lib/utils";
import { loadImage, uploadImage } from "@/lib/client/image";
import { canvasToBlob, cropCanvas, detectDirection, downscaleCanvas, enhanceForOcr, rotateImage } from "@/lib/ocr/preprocess";
import { recognizeText, type OcrDirection } from "@/lib/ocr/ocr-service";
import { QuoteForm, type QuoteFormValues } from "./quote-form";

type Step = "source" | "crop" | "edit";

export function QuoteCapture({ initialBook }: { initialBook: QuoteFormValues["book"] }) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const libraryRef = useRef<HTMLInputElement>(null);
  const sourceImg = useRef<HTMLImageElement | null>(null);
  const [step, setStep] = useState<Step>("source");
  const [rotation, setRotation] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [crop, setCrop] = useState<PercentCrop>();
  const [direction, setDirection] = useState<OcrDirection | "auto">("auto");
  const [joinLines, setJoinLines] = useState(true);
  const [withEnglish, setWithEnglish] = useState(false);
  const [saveImage, setSaveImage] = useState(true);
  const [ocr, setOcr] = useState<{ status: string; progress: number } | null>(null);
  const [text, setText] = useState("");
  const [confidence, setConfidence] = useState<number | null>(null);
  const [loadingImage, setLoadingImage] = useState(false);
  const [hasImage, setHasImage] = useState(false);
  const [ocrRun, setOcrRun] = useState(0);
  const croppedRef = useRef<HTMLCanvasElement | null>(null);

  const renderPreview = useCallback(async (rot: number) => {
    if (!sourceImg.current) return;
    const canvas = rotateImage(sourceImg.current, rot);
    const small = downscaleCanvas(canvas, 1600);
    setPreview(small.toDataURL("image/jpeg", 0.9));
  }, []);

  useEffect(() => {
    if (step === "crop") renderPreview(rotation);
  }, [rotation, step, renderPreview]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("画像ファイルを選択してください");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast.error("画像が大きすぎます（25MBまで）");
      return;
    }
    setLoadingImage(true);
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImage(url);
      sourceImg.current = img;
      setHasImage(true);
      setRotation(0);
      setCrop({ unit: "%", x: 5, y: 5, width: 90, height: 90 });
      setStep("crop");
      await renderPreview(0);
    } catch {
      toast.error("画像を読み込めませんでした。別の画像でお試しください。");
    } finally {
      setLoadingImage(false);
      if (cameraRef.current) cameraRef.current.value = "";
      if (libraryRef.current) libraryRef.current.value = "";
    }
  }

  async function runOcr(dirOverride?: OcrDirection) {
    if (!sourceImg.current) return;
    const rotated = rotateImage(sourceImg.current, rotation);
    const cropped = cropCanvas(rotated, crop && crop.width > 1 && crop.height > 1 ? crop : null);
    croppedRef.current = cropped;
    const auto = !dirOverride && direction === "auto";
    const dir: OcrDirection = dirOverride ?? (direction === "auto" ? detectDirection(cropped) : direction);
    setOcr({ status: "画像を準備しています", progress: 0 });
    try {
      const enhanced = enhanceForOcr(cropped);
      const blob = await canvasToBlob(enhanced, "image/png");
      let result = await recognizeText(blob, { direction: dir, withEnglish, joinLines, onProgress: setOcr });
      let usedDir = dir;
      // 自動判定で信頼度が低い場合は、もう一方の向きでも読み取り、良い方を採用する
      if (auto && (result.confidence ?? 100) < 70) {
        const other: OcrDirection = dir === "vertical" ? "horizontal" : "vertical";
        const alt = await recognizeText(blob, { direction: other, withEnglish, joinLines, onProgress: setOcr });
        if ((alt.confidence ?? 0) > (result.confidence ?? 0)) {
          result = alt;
          usedDir = other;
        }
      }
      setText(result.text);
      setConfidence(result.confidence);
      setOcrRun((n) => n + 1);
      if (!result.text.trim()) toast.warning("文字が見つかりませんでした。範囲や向きを調整してください。");
      setDirection(usedDir);
      setStep("edit");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setOcr(null);
    }
  }

  async function uploadCropped(): Promise<string | null> {
    if (!saveImage || !croppedRef.current) return null;
    const small = downscaleCanvas(croppedRef.current, 1400);
    const blob = await canvasToBlob(small, "image/jpeg", 0.8);
    return uploadImage(blob, "quote");
  }

  const initial: QuoteFormValues = { text, pageNumber: "", note: "", tags: "", isFavorite: false, book: initialBook, originalImage: null };

  if (step === "source") {
    return (
      <div className="space-y-4">
        {initialBook ? (
          <p className="rounded-xl bg-muted/60 p-3 text-sm">
            📖 『{initialBook.title}』のフレーズとして保存します
          </p>
        ) : null}
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} aria-label="カメラで撮影" />
        <input ref={libraryRef} type="file" accept="image/*" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} aria-label="写真ライブラリから選択" />
        <button
          type="button"
          onClick={() => cameraRef.current?.click()}
          disabled={loadingImage}
          className="flex min-h-36 w-full flex-col items-center justify-center gap-3 rounded-2xl bg-primary text-primary-foreground shadow-md active:scale-[0.99]"
        >
          {loadingImage ? <Loader2 className="size-10 animate-spin" /> : <Camera className="size-10" />}
          <span className="text-lg font-semibold">カメラで撮影</span>
          <span className="text-sm opacity-80">ページを撮影して文字を読み取ります</span>
        </button>
        <div className="grid grid-cols-2 gap-3">
          <Button variant="outline" className="h-16 flex-col gap-1" onClick={() => libraryRef.current?.click()} disabled={loadingImage}>
            <ImageIcon className="size-5" />
            写真ライブラリから選択
          </Button>
          <Button variant="outline" className="h-16 flex-col gap-1" onClick={() => setStep("edit")}>
            <Keyboard className="size-5" />
            テキストを入力
          </Button>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          文字認識は端末内で行われ、画像が外部に送信されることはありません（初回のみ日本語の認識データをダウンロードします）。カメラが使えない場合は写真ライブラリから選択してください。
        </p>
      </div>
    );
  }

  if (step === "crop") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => setStep("source")} className="-ml-2">
            <ArrowLeft /> 撮り直す
          </Button>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" aria-label="左に回転" onClick={() => setRotation((r) => r - 90)}>
              <RotateCcw />
            </Button>
            <Button variant="outline" size="icon" aria-label="右に回転" onClick={() => setRotation((r) => r + 90)}>
              <RotateCw />
            </Button>
          </div>
        </div>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <CropIcon className="size-4" /> 残したい文章の部分だけを指で囲んでください
        </p>
        <div className="flex justify-center overflow-hidden rounded-xl bg-muted/60 p-1">
          {preview ? (
            <ReactCrop crop={crop} onChange={(_, pc) => setCrop(pc)} keepSelection ruleOfThirds className="max-h-[60dvh] touch-none">
              <img src={preview} alt="トリミングする画像" className="max-h-[60dvh] w-auto object-contain" />
            </ReactCrop>
          ) : (
            <Loader2 className="my-20 size-8 animate-spin text-muted-foreground" />
          )}
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">文字の向き</legend>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                ["auto", "自動"],
                ["horizontal", "横書き"],
                ["vertical", "縦書き"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setDirection(k)}
                aria-pressed={direction === k}
                className={cn("h-11 rounded-lg border text-sm", direction === k ? "border-primary bg-primary/10 font-semibold text-primary" : "bg-card")}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="space-y-1 rounded-xl border bg-card px-3">
          <label className="flex min-h-12 items-center justify-between gap-3 text-sm">
            段落の改行を整える
            <Switch checked={joinLines} onCheckedChange={setJoinLines} />
          </label>
          <label className="flex min-h-12 items-center justify-between gap-3 border-t text-sm">
            英数字を多く含む
            <Switch checked={withEnglish} onCheckedChange={setWithEnglish} />
          </label>
          <label className="flex min-h-12 items-center justify-between gap-3 border-t text-sm">
            元画像も保存する
            <Switch checked={saveImage} onCheckedChange={setSaveImage} />
          </label>
        </div>
        {ocr ? (
          <div className="space-y-2 rounded-xl bg-muted/60 p-4" role="status" aria-live="polite">
            <p className="flex items-center gap-2 text-sm">
              <Loader2 className="size-4 animate-spin" /> {ocr.status}
            </p>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary transition-all" style={{ width: `${Math.round(ocr.progress * 100)}%` }} />
            </div>
          </div>
        ) : null}
        <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur lg:static lg:mx-0 lg:border-0 lg:px-0">
          <Button size="lg" className="w-full" onClick={() => runOcr()} disabled={!!ocr}>
            {ocr ? <Loader2 className="animate-spin" /> : <ScanText />}
            この範囲を読み取る
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {hasImage ? (
        <Button variant="ghost" size="sm" onClick={() => setStep("crop")} className="-ml-2">
          <ArrowLeft /> 範囲を選び直す
        </Button>
      ) : null}
      <QuoteForm
        initial={initial}
        textVersion={ocrRun}
        beforeSave={hasImage ? uploadCropped : undefined}
        textSlot={
          hasImage ? (
            <div className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/60 p-2.5 text-sm">
              <span className="flex-1 text-muted-foreground">
                OCR結果を確認・修正してください
                {confidence != null ? `（信頼度 ${Math.round(confidence)}%）` : ""}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!!ocr}
                onClick={() => runOcr(direction === "vertical" ? "horizontal" : "vertical")}
                title="縦書き・横書きを切り替えて読み直します"
              >
                {ocr ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                {direction === "vertical" ? "横書きで再OCR" : "縦書きで再OCR"}
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={!!ocr} onClick={() => runOcr(direction === "auto" ? undefined : direction)}>
                <RefreshCw /> 再OCR
              </Button>
              {ocr ? <p className="w-full text-xs text-muted-foreground">{ocr.status}</p> : null}
            </div>
          ) : null
        }
      />
    </div>
  );
}
