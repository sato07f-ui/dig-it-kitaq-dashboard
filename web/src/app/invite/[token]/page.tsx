import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { acceptInvitation } from "./actions";

export default async function InvitePage({ params }: { params: { token: string } }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-6 text-center">
        <p>招待を受け取るには、招待されたメールアドレスでログインしてください。</p>
        <Link href={`/login?next=${encodeURIComponent(`/invite/${params.token}`)}`} className="rounded-md bg-accent px-4 py-2 text-white">
          ログイン
        </Link>
      </main>
    );
  }

  const { error } = await acceptInvitation(params.token);

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-6 text-center">
      {error ? (
        <p className="text-status-risk">
          招待の受諾に失敗しました({error})。招待の期限が切れているか、既に使用されているか、招待されたメールアドレスと異なる可能性があります。
        </p>
      ) : (
        <p>プロジェクトへの参加が完了しました。</p>
      )}
      <Link href="/projects" className="rounded-md bg-accent px-4 py-2 text-white">
        プロジェクト一覧へ
      </Link>
    </main>
  );
}
