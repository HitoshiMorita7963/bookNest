import { PageHeader } from "@/components/layout/page-header";
import { ProjectForm } from "@/components/creative/project-forms";

export const metadata = { title: "新しい小説" };

export default function NewProjectPage() {
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="✍️ 新しい小説" back />
      <p className="mb-4 text-sm text-muted-foreground">タイトルだけで作成できます。あらすじや人物はあとから少しずつ足していきましょう。</p>
      <ProjectForm />
    </div>
  );
}
