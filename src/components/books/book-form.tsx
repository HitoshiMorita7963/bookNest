"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ImagePlus, Loader2, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form-controls";
import { BookCover } from "./book-cover";
import { BOOK_STATUSES, DEFAULT_GENRES, STATUS_LABEL } from "@/lib/constants";
import { parseIsbn } from "@/lib/isbn";
import { splitList } from "@/lib/utils";
import { classifyBookAction, createBookAction, updateBookAction } from "@/server/actions/books";
import type { ClassifyInput } from "@/lib/classify";
import { downscaleImage, uploadImage } from "@/lib/client/image";

const formSchema = z.object({
  title: z.string().trim().min(1, "タイトルを入力してください").max(300, "300文字以内で入力してください"),
  titleKana: z.string().max(300),
  subtitle: z.string().max(300),
  authors: z.string().max(500),
  publisher: z.string().max(200),
  publishedAt: z
    .string()
    .max(20)
    .refine((v) => !v || /^\d{4}(-\d{1,2}(-\d{1,2})?)?$/.test(v.trim()), "「2024」「2024-05」「2024-05-10」の形式で入力してください"),
  pageCount: z.string().refine((v) => !v || (/^\d+$/.test(v.normalize("NFKC")) && Number(v.normalize("NFKC")) > 0), "ページ数は数字で入力してください"),
  isbn: z.string().refine((v) => !v.trim() || parseIsbn(v) !== null, "ISBNが正しくありません（10桁または13桁）"),
  coverImage: z.string().max(2000),
  genre: z.string().max(50),
  tags: z.string().max(1000),
  seriesTitle: z.string().max(200),
  seriesNumber: z.string().refine((v) => !v || !Number.isNaN(Number(v)), "巻数は数字で入力してください"),
  status: z.enum(BOOK_STATUSES),
  acquiredAt: z.string(),
  description: z.string().max(5000, "5000文字以内で入力してください"),
});
export type BookFormValues = z.infer<typeof formSchema>;

export const emptyBookForm: BookFormValues = {
  title: "",
  titleKana: "",
  subtitle: "",
  authors: "",
  publisher: "",
  publishedAt: "",
  pageCount: "",
  isbn: "",
  coverImage: "",
  genre: "",
  tags: "",
  seriesTitle: "",
  seriesNumber: "",
  status: "WANT_TO_READ",
  acquiredAt: "",
  description: "",
};

export function BookForm({
  bookId,
  defaultValues,
  submitLabel = "保存する",
  compact = false,
  classifyFrom,
}: {
  bookId?: string;
  defaultValues?: Partial<BookFormValues>;
  submitLabel?: string;
  /** ISBN 検索結果の確認時は詳細項目を折りたたむ */
  compact?: boolean;
  /** 新規登録時、この書誌情報からジャンル・タグを自動で入れる */
  classifyFrom?: ClassifyInput & { authors?: string[]; isbn13?: string | null };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [showMore, setShowMore] = useState(!compact);
  const [dupId, setDupId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    getFieldState,
    getValues,
    formState: { errors },
  } = useForm<BookFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { ...emptyBookForm, ...defaultValues },
  });

  const [classifying, setClassifying] = useState<"idle" | "running" | "ai" | "rules">("idle");
  useEffect(() => {
    if (bookId || !classifyFrom) return;
    let cancelled = false;
    queueMicrotask(() => !cancelled && setClassifying("running"));
    classifyBookAction(classifyFrom)
      .then((res) => {
        if (cancelled) return;
        if (!res.ok || (!res.data.genre && !res.data.tags.length)) return setClassifying("idle");
        // 提案を待つ間にユーザーが入力していたら上書きしない
        if (res.data.genre && !getFieldState("genre").isDirty && !getValues("genre")) setValue("genre", res.data.genre);
        if (res.data.tags.length && !getFieldState("tags").isDirty && !getValues("tags")) setValue("tags", res.data.tags.join("、"));
        setClassifying(res.data.by);
      })
      .catch(() => !cancelled && setClassifying("idle"));
    return () => {
      cancelled = true;
    };
    // 書誌情報が変わったときだけ提案し直す
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, classifyFrom]);

  const cover = useWatch({ control, name: "coverImage" });
  const title = useWatch({ control, name: "title" });

  async function onPickCover(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const blob = await downscaleImage(file, 1200, 0.88);
      const url = await uploadImage(blob, "cover");
      setValue("coverImage", url, { shouldDirty: true });
      toast.success("表紙画像を設定しました");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const onSubmit = handleSubmit((v) => {
    setDupId(null);
    const payload = {
      ...v,
      authors: splitList(v.authors.replace(/[／/]/g, ",")),
      tags: splitList(v.tags),
      pageCount: v.pageCount ? v.pageCount.normalize("NFKC") : null,
      acquiredAt: v.acquiredAt || null,
    };
    startTransition(async () => {
      const res = bookId ? await updateBookAction(bookId, payload) : await createBookAction(payload);
      if (!res.ok) {
        toast.error(res.error);
        if (res.code === "DUPLICATE" && typeof res.meta?.bookId === "string") setDupId(res.meta.bookId);
        return;
      }
      toast.success(bookId ? "保存しました" : `『${v.title}』を登録しました`);
      router.push(`/books/${res.data.id}`);
      router.refresh();
    });
  });

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div className="flex gap-4">
        <div className="w-28 shrink-0 space-y-2 sm:w-32">
          <BookCover src={cover || null} title={title || "表紙"} size="sm" />
          <input ref={fileRef} type="file" accept="image/*" className="sr-only" id="cover-file" onChange={(e) => onPickCover(e.target.files?.[0])} />
          <div className="flex gap-1">
            <Button type="button" variant="outline" size="sm" className="flex-1" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="animate-spin" /> : <ImagePlus />}
              <span className="sr-only sm:not-sr-only">画像</span>
            </Button>
            {cover ? (
              <Button type="button" variant="ghost" size="icon-sm" aria-label="表紙画像を削除" onClick={() => setValue("coverImage", "")}>
                <Trash2 />
              </Button>
            ) : null}
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-4">
          <Field label="タイトル *" htmlFor="title" error={errors.title?.message}>
            <Input id="title" {...register("title")} aria-invalid={!!errors.title} autoComplete="off" />
          </Field>
          <Field label="著者" htmlFor="authors" hint="複数の場合は「、」で区切る">
            <Input id="authors" {...register("authors")} autoComplete="off" />
          </Field>
        </div>
      </div>

      <Field label="ステータス" htmlFor="status">
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="ステータス">
          {BOOK_STATUSES.map((s) => (
            <label
              key={s}
              className="flex h-11 cursor-pointer items-center justify-center rounded-lg border bg-card text-sm has-[:checked]:border-primary has-[:checked]:bg-primary/10 has-[:checked]:font-semibold has-[:checked]:text-primary"
            >
              <input type="radio" value={s} {...register("status")} className="sr-only" />
              {STATUS_LABEL[s]}
            </label>
          ))}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="ページ数" htmlFor="pageCount" error={errors.pageCount?.message}>
          <Input id="pageCount" inputMode="numeric" {...register("pageCount")} aria-invalid={!!errors.pageCount} />
        </Field>
        <Field label="ジャンル" htmlFor="genre">
          <Input id="genre" list="genre-list" {...register("genre")} autoComplete="off" />
          <datalist id="genre-list">
            {DEFAULT_GENRES.map((g) => (
              <option key={g} value={g} />
            ))}
          </datalist>
        </Field>
      </div>

      <Field label="タグ" htmlFor="tags" hint="「、」区切り（例：哲学、人生）">
        <Input id="tags" {...register("tags")} autoComplete="off" />
      </Field>
      {classifying !== "idle" ? (
        <p className="-mt-3 flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
          {classifying === "running" ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5 text-primary" />}
          {classifying === "running"
            ? "ジャンル・タグを提案しています…"
            : `ジャンル・タグを${classifying === "ai" ? "AIが" : ""}自動で入力しました。自由に変更できます。`}
        </p>
      ) : null}

      {!showMore ? (
        <Button type="button" variant="ghost" className="w-full" onClick={() => setShowMore(true)}>
          詳細項目を表示（出版社・ISBN・シリーズなど）
        </Button>
      ) : (
        <div className="space-y-4">
          <Field label="サブタイトル" htmlFor="subtitle">
            <Input id="subtitle" {...register("subtitle")} />
          </Field>
          <Field label="よみがな" htmlFor="titleKana">
            <Input id="titleKana" {...register("titleKana")} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="出版社" htmlFor="publisher">
              <Input id="publisher" {...register("publisher")} />
            </Field>
            <Field label="発売日" htmlFor="publishedAt" error={errors.publishedAt?.message}>
              <Input id="publishedAt" placeholder="2024-05-10" {...register("publishedAt")} aria-invalid={!!errors.publishedAt} />
            </Field>
          </div>
          <Field label="ISBN" htmlFor="isbn" error={errors.isbn?.message}>
            <Input id="isbn" inputMode="numeric" {...register("isbn")} aria-invalid={!!errors.isbn} />
          </Field>
          <div className="grid grid-cols-[1fr_6rem] gap-4">
            <Field label="シリーズ" htmlFor="seriesTitle">
              <Input id="seriesTitle" {...register("seriesTitle")} />
            </Field>
            <Field label="巻" htmlFor="seriesNumber" error={errors.seriesNumber?.message}>
              <Input id="seriesNumber" inputMode="decimal" {...register("seriesNumber")} />
            </Field>
          </div>
          <Field label="購入日・入手日" htmlFor="acquiredAt" hint="積読期間の計算に使います">
            <Input id="acquiredAt" type="date" {...register("acquiredAt")} />
          </Field>
          <Field label="表紙画像URL" htmlFor="coverImage">
            <Input id="coverImage" inputMode="url" {...register("coverImage")} placeholder="https://..." />
          </Field>
          <Field label="内容紹介" htmlFor="description" error={errors.description?.message}>
            <Textarea id="description" rows={5} {...register("description")} />
          </Field>
        </div>
      )}

      {dupId ? (
        <p className="rounded-lg bg-accent p-3 text-sm">
          既に登録されている本です。
          <Link href={`/books/${dupId}`} className="ml-1 font-medium text-primary underline">
            登録済みの本を開く
          </Link>
        </p>
      ) : null}

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-10 -mx-4 border-t bg-background/95 px-4 py-3 backdrop-blur lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0">
        <Button type="submit" size="lg" className="w-full" disabled={pending || uploading}>
          {pending ? <Loader2 className="animate-spin" /> : null}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

export function metadataToForm(m: {
  title: string;
  titleKana?: string | null;
  subtitle?: string | null;
  authors: string[];
  publisher?: string | null;
  publishedAt?: string | null;
  pageCount?: number | null;
  coverImage?: string | null;
  isbn13?: string | null;
  description?: string | null;
  seriesTitle?: string | null;
}): Partial<BookFormValues> {
  return {
    title: m.title,
    titleKana: m.titleKana ?? "",
    subtitle: m.subtitle ?? "",
    authors: m.authors.join("、"),
    publisher: m.publisher ?? "",
    publishedAt: m.publishedAt ?? "",
    pageCount: m.pageCount ? String(m.pageCount) : "",
    coverImage: m.coverImage ?? "",
    isbn: m.isbn13 ?? "",
    description: m.description ?? "",
    seriesTitle: m.seriesTitle && !/文庫|新書|選書|叢書|ライブラリー|ブックス$/.test(m.seriesTitle) ? m.seriesTitle : "",
  };
}
