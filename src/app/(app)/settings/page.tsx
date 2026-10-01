import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/layout/page-header";
import { AiCard, DataCard, OcrCard, ProfileCard, PwaCard, ThemeCard } from "@/components/settings/settings-client";
import { getSettings, getUser } from "@/server/services/settings";
import { hasSampleData } from "@/server/services/sample";
import { aiConfig } from "@/server/ai/config";
import { authEnabled } from "@/lib/auth";
import { LogoutButton } from "@/components/auth/login-form";

export const metadata = { title: "設定" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [user, settings, sample] = await Promise.all([getUser(prisma), getSettings(prisma), hasSampleData(prisma)]);
  const ai = aiConfig();
  const ocrServer = process.env.OCR_PROVIDER === "google-vision" && !!process.env.OCR_API_KEY;
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="設定" />
      <div className="space-y-4">
        <ProfileCard name={user.name} />
        <ThemeCard />
        <PwaCard />
        <DataCard hasSample={sample} />
        <AiCard settings={settings} configured={ai.configured} model={ai.model} />
        <OcrCard serverAvailable={ocrServer} />
        {authEnabled() ? (
          <div className="flex justify-center pt-2">
            <LogoutButton />
          </div>
        ) : null}
        <p className="pt-4 text-center text-xs text-muted-foreground">BookNest v0.1.0 ・ データはこの端末（サーバー）の SQLite に保存されています</p>
      </div>
    </div>
  );
}
