// 添付ダウンロード応答のヘッダー生成(純粋関数)
// inline配信は将来の表示フェーズ(サニタイズ+CSP設計)まで見送り、常にattachmentで返す
export function buildDownloadHeaders(
  meta: { filename: string; contentType: string },
  byteLength: number
): Record<string, string> {
  return {
    "Content-Type": meta.contentType,
    "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(meta.filename)}`,
    "Content-Length": String(byteLength),
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
  };
}
