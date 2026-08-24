import Link from "next/link";

export default function PasswordResetSentPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-bold">再設定メールを送信しました</h1>
      <p className="text-sm text-gray-600">
        該当のメールアドレスが登録されていれば、パスワード再設定用のリンクが届きます。
      </p>
      <Link href="/login" className="text-sm text-accent">
        ログインへ戻る
      </Link>
    </main>
  );
}
