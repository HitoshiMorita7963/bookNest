import { redirect } from "next/navigation";
import { BookNestLogo } from "@/components/layout/logo";
import { LoginForm } from "@/components/auth/login-form";
import { authEnabled } from "@/lib/auth";

export const metadata = { title: "ログイン" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  if (!authEnabled()) redirect("/");
  const { next = "/" } = await searchParams;
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 pb-[env(safe-area-inset-bottom)]">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <BookNestLogo className="size-16" />
          <h1 className="text-2xl font-bold">BookNest</h1>
          <p className="text-sm text-muted-foreground">読書と知識の記録</p>
        </div>
        <LoginForm next={next} />
      </div>
    </main>
  );
}
