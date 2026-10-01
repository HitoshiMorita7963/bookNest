import { Sidebar, BottomNav } from "@/components/layout/app-nav";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-card focus:p-3">
        本文へスキップ
      </a>
      <Sidebar />
      <div className="min-w-0 flex-1">
        <main
          id="main"
          className="mx-auto w-full max-w-6xl px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:px-6 lg:px-10 lg:pb-12"
        >
          {children}
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
