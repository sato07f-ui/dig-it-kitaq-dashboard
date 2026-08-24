import { createClient } from "@/lib/supabase/server";
import { Nav } from "@/components/Nav";
import { ProjectSidebar } from "@/components/ProjectSidebar";
import type { Project, Role } from "@/lib/types";

// /projects 以下の全ページ(一覧・詳細・メンバー・設定)で共有するレイアウト。
// 左サイドバーにプロジェクト一覧+追加フォームを常時表示する(Streamlit版の
// サイドバー相当)。
export default async function ProjectsLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();

  const { data: memberships } = await supabase
    .from("project_members")
    .select("role, joined_at, projects(id, name, description, status, owner_id, created_at)")
    .order("joined_at", { ascending: false });

  const projects = (memberships ?? [])
    .filter((m) => m.projects)
    .map((m) => ({ ...(m.projects as unknown as Project), your_role: m.role as Role }));

  return (
    <div className="flex min-h-screen flex-col">
      <Nav />
      <div className="flex flex-1">
        <ProjectSidebar projects={projects} />
        <main className="flex-1 overflow-x-hidden">{children}</main>
      </div>
    </div>
  );
}
