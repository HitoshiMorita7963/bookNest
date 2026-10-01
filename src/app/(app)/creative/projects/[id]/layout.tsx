import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { prisma } from "@/lib/db";
import { getProjectHeader } from "@/server/services/novels";
import { PageHeader } from "@/components/layout/page-header";
import { ProjectTabs } from "@/components/creative/project-tabs";
import { ProjectStatusBadge } from "@/components/creative/bits";
import { Button } from "@/components/ui/button";

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const p = await getProjectHeader(prisma, id);
  if (!p) notFound();
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title={`✍️ ${p.title}`}
        subtitle={<ProjectStatusBadge status={p.status} />}
        back="/creative"
        actions={
          <Button asChild variant="ghost" size="icon" aria-label="作品情報を編集">
            <Link href={`/creative/projects/${p.id}/edit`}>
              <Pencil className="size-5" />
            </Link>
          </Button>
        }
      />
      <ProjectTabs projectId={p.id} />
      {children}
    </div>
  );
}
