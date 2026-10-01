import { PageHeader } from "@/components/layout/page-header";
import { AddBookFlow } from "@/components/books/add-book-flow";

export const metadata = { title: "本を追加" };

export default async function NewBookPage({ searchParams }: { searchParams: Promise<{ mode?: string; q?: string }> }) {
  const sp = await searchParams;
  const mode = sp.mode === "scan" || sp.mode === "manual" ? sp.mode : "search";
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="本を追加" back />
      <AddBookFlow initialMode={mode} initialQuery={sp.q ?? ""} />
    </div>
  );
}
