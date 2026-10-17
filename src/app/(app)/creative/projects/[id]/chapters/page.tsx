import Link from "next/link";
import { FileDown } from "lucide-react";
import { prisma } from "@/lib/db";
import { projectToc } from "@/server/services/writing";
import { SectionTitle } from "@/components/books/bits";
import { ChapterSheetButton } from "@/components/creative/project-forms";
import { ProjectToc, ResumeCard } from "@/components/writing/project-toc";
import { Button } from "@/components/ui/button";

export const metadata = { title: "章・シーン" };

export default async function ChaptersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const toc = await projectToc(prisma, id);
  return (
    <div className="space-y-4">
      <ResumeCard toc={toc} />
      <section>
        <SectionTitle
          action={
            <div className="flex gap-2">
              {toc.chapters.length ? (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/print/projects/${id}`}>
                    <FileDown /> 書き出す
                  </Link>
                </Button>
              ) : null}
              <ChapterSheetButton projectId={id} />
            </div>
          }
        >
          📖 章・シーン{" "}
          <span className="text-sm font-normal text-muted-foreground">
            {toc.totalChars.toLocaleString()}字
          </span>
        </SectionTitle>
        <ProjectToc projectId={id} toc={toc} manage />
      </section>
    </div>
  );
}
