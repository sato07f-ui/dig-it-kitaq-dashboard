import Link from "next/link";

export default function CheckEmailPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-bold">確認メールを送信しました</h1>
      <p className="text-sm text-gray-600">
        メール内のリンクをクリックすると登録が完了します。届かない場合は迷惑メールフォルダもご確認ください。
      </p>
      <Link href="/login" className="text-sm text-accent">
        ログインへ戻る
      </Link>
    </main>
  );
}
