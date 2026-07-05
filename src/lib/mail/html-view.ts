// 送信者由来HTML本文を sandbox iframe の srcdoc に載せる完全HTML文書へ包む。
// タグ除去はしない(実行防止の主防御は iframe の sandbox="" 属性)。
// CSP は外部リソース/スクリプト/画像を一律遮断する多層防御の2枚目。
const CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src 'none'";

export function prepareHtmlBody(rawHtml: string): string {
  return (
    "<!doctype html><html><head><meta charset=\"utf-8\">" +
    `<meta http-equiv="Content-Security-Policy" content="${CSP}">` +
    "<base target=\"_blank\"></head><body>" +
    rawHtml +
    "</body></html>"
  );
}
