"use client";

import { useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * 画面上部の読み込みバー。
 * リンクを押した瞬間に表示を始め、URL が切り替わったら完了させる。
 * 状態は React の state ではなく DOM を直接更新する（再描画を起こさないため）。
 */
export function NavigationProgress() {
  const bar = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pathname = usePathname();
  const search = useSearchParams().toString();

  useEffect(() => {
    const el = bar.current;
    if (!el) return;
    const start = () => {
      if (timer.current) clearTimeout(timer.current);
      el.style.transition = "none";
      el.style.opacity = "1";
      el.style.transform = "scaleX(0.05)";
      requestAnimationFrame(() => {
        el.style.transition = "transform 8s cubic-bezier(0.1, 0.7, 0.2, 1)";
        el.style.transform = "scaleX(0.85)";
      });
      // 同じページへのリンクなど、URL が変わらない場合に備えて自動で消す
      timer.current = setTimeout(() => (el.style.opacity = "0"), 10000);
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || /^(https?:)?\/\//.test(href) || href.startsWith("mailto:")) return;
      const url = new URL(href, location.href);
      if (url.pathname === location.pathname && url.search === location.search) return;
      start();
    };
    const onCustom = () => start();
    document.addEventListener("click", onClick, true);
    window.addEventListener("booknest:navigate", onCustom);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("booknest:navigate", onCustom);
    };
  }, []);

  useEffect(() => {
    const el = bar.current;
    if (!el || el.style.opacity !== "1") return;
    if (timer.current) clearTimeout(timer.current);
    el.style.transition = "transform 0.2s ease-out, opacity 0.3s ease 0.2s";
    el.style.transform = "scaleX(1)";
    el.style.opacity = "0";
  }, [pathname, search]);

  return (
    <div
      ref={bar}
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px] origin-left bg-primary"
      style={{ opacity: 0, transform: "scaleX(0)", marginTop: "env(safe-area-inset-top)" }}
    />
  );
}

/** コードからの画面遷移（router.push など）の前に呼ぶと読み込みバーを表示する */
export function signalNavigation() {
  window.dispatchEvent(new Event("booknest:navigate"));
}
