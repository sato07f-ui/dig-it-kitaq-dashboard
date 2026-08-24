export default function ProjectsIndexPage() {
  return (
    <div className="mx-auto flex h-full min-h-[60vh] max-w-md flex-col items-center justify-center gap-2 px-6 text-center text-gray-500">
      <p className="text-lg font-medium text-gray-700">プロジェクトを選択してください</p>
      <p className="text-sm">
        左のサイドバーから既存のプロジェクトを選ぶか、下部のフォームから新しいプロジェクトを追加してください。
      </p>
    </div>
  );
}
