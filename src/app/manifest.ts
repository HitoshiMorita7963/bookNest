import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "BookNest - 読書と知識の記録",
    short_name: "BookNest",
    description: "読書によって形成されていく自分の知識と記憶を管理する、個人用の読書管理アプリ",
    lang: "ja",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    background_color: "#f8fafd",
    theme_color: "#1f4f99",
    categories: ["books", "education", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "フレーズを撮影", short_name: "フレーズ", url: "/quotes/new", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "本を追加", short_name: "本を追加", url: "/books/new?mode=scan", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "読書中", short_name: "読書中", url: "/reading", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
