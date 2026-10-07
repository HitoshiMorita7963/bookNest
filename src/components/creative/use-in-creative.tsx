"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Brain, Link2, Loader2, PenLine, Search, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Switch } from "@/components/ui/form-controls";
import { Sheet, SheetContent, Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/overlays";
import { CategoryChips, CategoryBadge } from "./bits";
import { NoteForm } from "./note-form";
import { TargetPicker, type TargetValue } from "./target-picker";
import { SaveToCkBody } from "@/components/creative-knowledge/save-to-ck";
import { createLinkAction, pickCreativeNotesAction } from "@/server/actions/creative";
import { LINK_SOURCE_LABEL, type CreativeCategory, type LinkSourceKind, type LinkTargetKind } from "@/lib/constants";

/** カテゴリから自然な紐付け先を推測（人物メモ → 人物 など） */
function kindForCategory(c: CreativeCategory): Exclude<LinkTargetKind, "note"> {
  switch (c) {
    case "CHARACTER":
      return "character";
    case "SETTING":
      return "world";
    case "PLOT":
      return "plot";
    case "SCENE":
    case "DIALOGUE":
    case "DESCRIPTION":
      return "scene";
    default:
      return "project";
  }
}

export function UseInCreativeButton({
  source,
  defaultTitle = "",
  defaultContent = "",
  className,
}: {
  source: { kind: Exclude<LinkSourceKind, "note">; id: string };
  defaultTitle?: string;
  defaultContent?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className={className}>
        <Sparkles /> 創作に使う
      </Button>
      <Sheet open={open} onOpenChange={setOpen} repositionInputs={false}>
        <SheetContent title="創作に使う" description={`この${LINK_SOURCE_LABEL[source.kind]}を何に使いますか？`}>
          <UseInCreativeBody source={source} defaultTitle={defaultTitle} defaultContent={defaultContent} onDone={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}

function UseInCreativeBody({
  source,
  defaultTitle,
  defaultContent,
  onDone,
}: {
  source: { kind: Exclude<LinkSourceKind, "note">; id: string };
  defaultTitle: string;
  defaultContent: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState("note");
  const [category, setCategory] = useState<CreativeCategory>("OTHER");
  const [step, setStep] = useState<"category" | "form">(source.kind === "quote" ? "category" : "form");
  const [alsoProject, setAlsoProject] = useState(false);
  const [target, setTarget] = useState<TargetValue | null>(null);
  const [pending, start] = useTransition();

  function linkToProject() {
    if (!target) return void toast.error("紐付け先を選んでください");
    start(async () => {
      const res = await createLinkAction({ source, target: target.target, purpose: target.purpose || null });
      if (!res.ok) return void toast.error(res.error);
      toast.success("作品に関連付けました");
      onDone();
      router.refresh();
    });
  }

  return (
    <Tabs value={mode} onValueChange={setMode}>
      <TabsList className="grid grid-cols-4">
        <TabsTrigger value="note" className="px-1 text-xs sm:text-sm">
          <PenLine className="size-4" /> メモを作る
        </TabsTrigger>
        <TabsTrigger value="project" className="px-1 text-xs sm:text-sm">
          <Link2 className="size-4" /> 作品に関連付け
        </TabsTrigger>
        <TabsTrigger value="existing" className="px-1 text-xs sm:text-sm">
          <Search className="size-4" /> 既存のメモ
        </TabsTrigger>
        <TabsTrigger value="ck" className="px-1 text-xs sm:text-sm">
          <Brain className="size-4" /> 創作知識
        </TabsTrigger>
      </TabsList>

      <TabsContent value="note" className="space-y-4">
        {step === "category" ? (
          <div className="space-y-3">
            <p className="text-sm font-medium">何に使いますか？</p>
            <CategoryChips
              value={category}
              categories={["CHARACTER", "SETTING", "PLOT", "SCENE", "DIALOGUE", "DESCRIPTION", "OTHER"]}
              onChange={(c) => {
                setCategory(c);
                setStep("form");
              }}
            />
          </div>
        ) : (
          <>
            <div className="space-y-2 rounded-xl border bg-card p-3">
              <label className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium">作品にも追加する</span>
                <Switch checked={alsoProject} onCheckedChange={setAlsoProject} aria-label="作品にも追加する" />
              </label>
              {alsoProject ? <TargetPicker key={category} defaultKind={kindForCategory(category)} onChange={setTarget} /> : null}
            </div>
            <NoteForm
              key={category}
              initial={{ title: defaultTitle, content: defaultContent, category }}
              link={{ source, target: alsoProject && target ? target.target : undefined, purpose: alsoProject ? target?.purpose || null : null }}
              submitLabel="創作メモを作成"
              onSaved={(id) => {
                onDone();
                router.push(`/creative/notes/${id}`);
                router.refresh();
              }}
            />
          </>
        )}
      </TabsContent>

      <TabsContent value="project" className="space-y-4">
        <TargetPicker onChange={setTarget} />
        <Button size="lg" className="w-full" onClick={linkToProject} disabled={pending || !target}>
          {pending ? <Loader2 className="animate-spin" /> : <Link2 />} 関連付ける
        </Button>
      </TabsContent>

      <TabsContent value="existing">
        <ExistingNotePicker source={source} onDone={onDone} />
      </TabsContent>

      <TabsContent value="ck">
        <SaveToCkBody source={{ kind: source.kind === "knowledge" ? "knowledgeNote" : source.kind, id: source.id }} onDone={onDone} />
      </TabsContent>
    </Tabs>
  );
}

function ExistingNotePicker({ source, onDone }: { source: { kind: Exclude<LinkSourceKind, "note">; id: string }; onDone: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Awaited<ReturnType<typeof pickCreativeNotesAction>> | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => {
    const t = setTimeout(() => pickCreativeNotesAction(q).then(setItems), 250);
    return () => clearTimeout(t);
  }, [q]);
  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="創作メモを検索" className="pl-9" aria-label="創作メモを検索" />
      </div>
      {!items ? (
        <Loader2 className="mx-auto my-4 size-6 animate-spin text-muted-foreground" />
      ) : items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">創作メモがありません。「メモを作る」から作成できます。</p>
      ) : (
        <ul className="divide-y">
          {items.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    const res = await createLinkAction({ source, target: { kind: "note", id: n.id }, purpose: null });
                    if (!res.ok) return void toast.error(res.error);
                    toast.success(`「${n.title}」に関連付けました`);
                    onDone();
                    router.refresh();
                  })
                }
                className="flex min-h-12 w-full items-center gap-2 py-2 text-left"
              >
                <span className="min-w-0 flex-1 truncate font-medium">💡 {n.title}</span>
                <CategoryBadge category={n.category} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
