import { Nav } from "@/components/Nav";
import { createClient } from "@/lib/supabase/server";
import { redeemCode, unlinkSlack } from "./actions";

export default async function SlackSettingsPage({
  searchParams,
}: {
  searchParams: { error?: string; linked?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: link } = user
    ? await supabase
        .from("slack_links")
        .select("slack_user_id, slack_team_id")
        .eq("user_id", user.id)
        .maybeSingle()
    : { data: null };

  return (
    <>
      <Nav />
      <main className="mx-auto flex max-w-sm flex-col gap-6 px-6 py-10">
        <h1 className="text-2xl font-bold">Slack連携</h1>

        {searchParams.error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{searchParams.error}</p>
        )}
        {searchParams.linked && (
          <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">連携しました。</p>
        )}

        {link ? (
          <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-white p-4">
            <p className="text-sm text-gray-600">連携済み(Slackユーザー: {link.slack_user_id})</p>
            <form action={unlinkSlack}>
              <button type="submit" className="text-sm text-status-risk">
                連携を解除する
              </button>
            </form>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-gray-600">
              Slackで <code className="rounded bg-gray-100 px-1">/link</code> と入力すると表示されるコードをここに入力してください(5分以内)。
            </p>
            <form action={redeemCode} className="flex gap-3">
              <input
                name="code"
                placeholder="コード"
                required
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 uppercase"
              />
              <button type="submit" className="rounded-md bg-accent px-4 py-2 text-sm text-white">
                連携する
              </button>
            </form>
          </div>
        )}
      </main>
    </>
  );
}
