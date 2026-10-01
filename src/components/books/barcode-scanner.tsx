"use client";

/**
 * ISBN バーコードスキャナー
 *  1. ブラウザ標準の BarcodeDetector API（Android Chrome 等）
 *  2. 非対応ブラウザ（iOS Safari 等）は ZXing によるデコード
 *  3. カメラが使えない場合は「写真から読み取る」へフォールバック
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ImageIcon, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isBookEan } from "@/lib/isbn";

type DetectorLike = { detect(source: CanvasImageSource): Promise<{ rawValue: string }[]> };

function createNativeDetector(): DetectorLike | null {
  const BD = (globalThis as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => DetectorLike }).BarcodeDetector;
  if (!BD) return null;
  try {
    return new BD({ formats: ["ean_13"] });
  } catch {
    return null;
  }
}

export function BarcodeScanner({ onDetected, paused }: { onDetected: (isbn: string) => void; paused?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const stopRef = useRef<() => void>(() => {});
  const lastRef = useRef<string>("");
  const [state, setState] = useState<"idle" | "starting" | "scanning" | "denied" | "unsupported" | "error">("idle");
  const [decodingImage, setDecodingImage] = useState(false);
  const [imageError, setImageError] = useState<string | null>(null);

  const handleCode = useCallback(
    (code: string) => {
      const c = code.replace(/\D/g, "");
      if (!isBookEan(c) || c === lastRef.current) return false;
      lastRef.current = c;
      navigator.vibrate?.(60);
      onDetected(c);
      return true;
    },
    [onDetected],
  );

  const stop = useCallback(() => {
    stopRef.current();
    stopRef.current = () => {};
  }, []);

  const start = useCallback(async () => {
    stop();
    lastRef.current = "";
    if (!navigator.mediaDevices?.getUserMedia) {
      setState("unsupported");
      return;
    }
    setState("starting");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
    } catch (e) {
      const name = (e as DOMException).name;
      setState(name === "NotAllowedError" || name === "SecurityError" ? "denied" : "error");
      return;
    }
    const video = videoRef.current;
    if (!video) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    video.srcObject = stream;
    await video.play().catch(() => undefined);
    setState("scanning");

    let stopped = false;
    let zxingControls: { stop: () => void } | null = null;
    stopRef.current = () => {
      stopped = true;
      zxingControls?.stop();
      stream.getTracks().forEach((t) => t.stop());
      if (video) video.srcObject = null;
    };

    const native = createNativeDetector();
    if (native) {
      const loop = async () => {
        if (stopped) return;
        try {
          if (video.readyState >= 2) {
            const codes = await native.detect(video);
            for (const c of codes) if (handleCode(c.rawValue)) break;
          }
        } catch {
          /* フレーム単位の失敗は無視 */
        }
        setTimeout(loop, 250);
      };
      loop();
    } else {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const { DecodeHintType, BarcodeFormat } = await import("@zxing/library");
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13]);
      const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 200 });
      if (stopped) return;
      zxingControls = await reader.decodeFromStream(stream, video, (result) => {
        if (result) handleCode(result.getText());
      });
    }
  }, [handleCode, stop]);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  useEffect(() => {
    if (paused) stop();
  }, [paused, stop]);

  async function decodeImage(file: File | undefined) {
    if (!file) return;
    setDecodingImage(true);
    setImageError(null);
    const url = URL.createObjectURL(file);
    try {
      const native = createNativeDetector();
      let found = false;
      if (native) {
        const bmp = await createImageBitmap(file);
        const codes = await native.detect(bmp);
        found = codes.some((c) => handleCode(c.rawValue));
      }
      if (!found) {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        const r = await reader.decodeFromImageUrl(url).catch(() => null);
        found = !!r && handleCode(r.getText());
      }
      if (!found) setImageError("バーコードを読み取れませんでした。978/979 で始まるバーコードが大きく写るように撮影してください。");
    } catch {
      setImageError("画像を読み込めませんでした。");
    } finally {
      URL.revokeObjectURL(url);
      setDecodingImage(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-black">
        <video ref={videoRef} className="size-full object-cover" playsInline muted aria-label="カメラ映像" />
        {state === "scanning" ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="relative h-[28%] w-[78%] rounded-xl border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]">
              <div className="absolute inset-x-3 top-1/2 h-0.5 animate-pulse bg-red-500/80" />
            </div>
            <p className="absolute bottom-3 rounded-full bg-black/60 px-3 py-1 text-xs text-white">ISBN（978…）のバーコードを枠に合わせてください</p>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
            {state === "starting" ? (
              <Loader2 className="size-8 animate-spin" />
            ) : state === "denied" ? (
              <>
                <p className="text-sm">カメラの使用が許可されていません。</p>
                <p className="text-xs text-white/70">ブラウザの設定でカメラを許可するか、下の「写真から読み取る」をご利用ください。</p>
              </>
            ) : state === "unsupported" || state === "error" ? (
              <p className="text-sm">このブラウザではカメラを起動できませんでした。写真から読み取るか、ISBNを入力してください。</p>
            ) : (
              <Button type="button" size="lg" onClick={start} className="bg-white text-black hover:bg-white/90">
                <Camera className="size-5" />
                カメラを起動
              </Button>
            )}
          </div>
        )}
      </div>
      <div className="flex gap-2">
        {state === "scanning" ? (
          <Button type="button" variant="outline" className="flex-1" onClick={() => { stop(); setState("idle"); }}>
            停止
          </Button>
        ) : state !== "idle" ? (
          <Button type="button" variant="outline" className="flex-1" onClick={start}>
            <RefreshCw /> 再試行
          </Button>
        ) : null}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => decodeImage(e.target.files?.[0])} />
        <Button type="button" variant="outline" className="flex-1" onClick={() => fileRef.current?.click()} disabled={decodingImage}>
          {decodingImage ? <Loader2 className="animate-spin" /> : <ImageIcon />}
          写真から読み取る
        </Button>
      </div>
      {imageError ? <p className="text-sm text-destructive" role="alert">{imageError}</p> : null}
    </div>
  );
}
