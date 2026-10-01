"use client";

import { useEffect, useState } from "react";
import { Download, Check, Share } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** PWA インストール。Android/PC は beforeinstallprompt、iOS は手順を案内 */
export function InstallButton() {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const handler = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", onInstalled);
    // 外部状態（表示モード・UA）を読み取って反映する
    queueMicrotask(() => {
      setInstalled(standalone);
      setIos(isIos);
    });
    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) {
    return (
      <p className="flex items-center gap-2 text-sm text-primary">
        <Check className="size-4" /> アプリとしてインストール済みです
      </p>
    );
  }
  if (evt) {
    return (
      <Button
        onClick={async () => {
          await evt.prompt();
          const r = await evt.userChoice;
          if (r.outcome === "accepted") setInstalled(true);
          setEvt(null);
        }}
      >
        <Download /> ホーム画面にインストール
      </Button>
    );
  }
  return (
    <div className="space-y-1 text-sm text-muted-foreground">
      {ios ? (
        <p className="flex flex-wrap items-center gap-1">
          Safari の <Share className="inline size-4" aria-label="共有" /> 共有ボタン →「ホーム画面に追加」でインストールできます。
        </p>
      ) : (
        <p>ブラウザのメニューから「アプリをインストール」または「ホーム画面に追加」を選んでください。</p>
      )}
      <p className="text-xs">※ インストールには HTTPS 接続（または localhost）が必要です。</p>
    </div>
  );
}
