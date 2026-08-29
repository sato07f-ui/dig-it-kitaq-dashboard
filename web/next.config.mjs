import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

/** @type {import('next').NextConfig} */
const nextConfig = {};

export default nextConfig;

// `next dev` 実行時にCloudflareのbindings(wrangler.jsonc)へアクセスできるようにする。
// 本番/プレビューはopennextjs-cloudflareのビルド・デプロイコマンドが別途処理する。
initOpenNextCloudflareForDev();
