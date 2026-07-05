import path from "node:path";
import { FsStorageProvider } from "./fs-adapter";
import type { StorageProvider } from "./provider";

export type { StorageProvider } from "./provider";
export { FsStorageProvider } from "./fs-adapter";

// 添付1ファイルの上限バイト数。既定25MiB。呼び出し毎に env を読む（テストで差し替え可）。
export function attachmentMaxBytes(): number {
  const v = Number(process.env.ATTACHMENT_MAX_BYTES);
  return Number.isFinite(v) && v > 0 ? v : 26_214_400;
}

const baseDir = process.env.STORAGE_DIR ?? path.resolve(process.cwd(), "var/attachments");

// アプリ既定のストレージ。ingest とダウンロードルートが共有する。
export const storage: StorageProvider = new FsStorageProvider(baseDir);
