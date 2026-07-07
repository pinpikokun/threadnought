// 送信者由来HTML本文を sandbox iframe の srcdoc に載せる完全HTML文書へ包む。
// タグ除去はしない(実行防止の主防御は iframe の sandbox="" 属性)。
// CSP は外部リソース/スクリプトを一律遮断する多層防御の2枚目。
// img-src data: はインライン画像(cid→data URI 埋め込み)のみ許可する。
// http(s) の画像を許さないため、外部トラッキング画像は依然として読み込まれない。
const CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data:";

export function prepareHtmlBody(rawHtml: string): string {
  return (
    "<!doctype html><html><head><meta charset=\"utf-8\">" +
    `<meta http-equiv="Content-Security-Policy" content="${CSP}">` +
    "<base target=\"_blank\"></head><body>" +
    rawHtml +
    "</body></html>"
  );
}

export type InlineImage = { contentId: string; dataUri: string };

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// HTML本文中の cid: 参照(インライン画像)を data: URI へ置換する。
// contentId が長いものから処理し、接頭辞衝突(cid:abc が cid:abcdef を巻き込む)を防ぐ。
// 直後が contentId 継続文字なら一致させない(部分一致防止)。
// 置換文字列は関数で返し、base64 中の `$` 等が特殊解釈されるのを避ける。
export function inlineCidImages(html: string, images: InlineImage[]): string {
  let out = html;
  const sorted = [...images].sort((a, b) => b.contentId.length - a.contentId.length);
  for (const img of sorted) {
    if (!img.contentId) continue;
    const re = new RegExp("cid:" + escapeRegExp(img.contentId) + "(?![\\w.@+\\-])", "gi");
    out = out.replace(re, () => img.dataUri);
  }
  return out;
}
