import { defineCloudflareConfig } from "@opennextjs/cloudflare/config";

// ISR/データキャッシュを永続化したい場合はR2 incremental cacheを追加する
// (see https://opennext.js.org/cloudflare/caching)。このアプリは全ページが
// cookieベースのSSRで静的生成に依存していないため、まずはデフォルト
// (インメモリ・Workerインスタンス単位)のままにしている。
export default defineCloudflareConfig();
