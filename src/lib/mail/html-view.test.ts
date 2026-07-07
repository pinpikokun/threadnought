import { describe, it, expect } from "vitest";
import { prepareHtmlBody, inlineCidImages } from "./html-view";

describe("prepareHtmlBody", () => {
  it("CSPメタと文書骨格を付与する", () => {
    const out = prepareHtmlBody("<p>hi</p>");
    expect(out).toContain("<!doctype html>");
    expect(out).toContain('charset="utf-8"');
    expect(out).toContain("Content-Security-Policy");
    expect(out).toContain("default-src 'none'");
    expect(out).toContain("<p>hi</p>");
  });
  it("スクリプトやhandlerを許可するCSPトークンを含まない", () => {
    const out = prepareHtmlBody('<img src=x onerror="alert(1)"><script>alert(1)</script>');
    // 本関数はタグを除去しない(sandboxが実行を防ぐ)。だが CSP は script/外部を許可しない。
    expect(out).not.toContain("script-src");
    expect(out).not.toContain("unsafe-eval");
  });
  it("画像は data: のみ許可し、外部(http/https)画像は許可しない", () => {
    const out = prepareHtmlBody("<p>hi</p>");
    expect(out).toContain("img-src data:");
    // 外部スキームやワイルドカードを画像に許していないこと(トラッキング画像の遮断)。
    expect(out).not.toContain("img-src *");
    expect(out).not.toMatch(/img-src[^;]*https?:/);
  });
});

describe("inlineCidImages", () => {
  it("cid 参照を対応する data URI へ置換する", () => {
    const html = '<img src="cid:logo123"> と <img src="cid:sig456">';
    const out = inlineCidImages(html, [
      { contentId: "logo123", dataUri: "data:image/png;base64,AAAA" },
      { contentId: "sig456", dataUri: "data:image/gif;base64,BBBB" },
    ]);
    expect(out).toContain('src="data:image/png;base64,AAAA"');
    expect(out).toContain('src="data:image/gif;base64,BBBB"');
    expect(out).not.toContain("cid:");
  });

  it("接頭辞が重なる contentId を取り違えない(長い方を優先)", () => {
    const html = '<img src="cid:abc"> <img src="cid:abcdef">';
    const out = inlineCidImages(html, [
      { contentId: "abc", dataUri: "data:image/png;base64,SHORT" },
      { contentId: "abcdef", dataUri: "data:image/png;base64,LONG" },
    ]);
    expect(out).toContain('src="data:image/png;base64,SHORT"');
    expect(out).toContain('src="data:image/png;base64,LONG"');
  });

  it("base64 中の $ 記号を特殊解釈しない", () => {
    const html = '<img src="cid:x">';
    const out = inlineCidImages(html, [{ contentId: "x", dataUri: "data:image/png;base64,a$1b" }]);
    expect(out).toContain('src="data:image/png;base64,a$1b"');
  });

  it("該当しない cid は残す", () => {
    const html = '<img src="cid:unknown">';
    const out = inlineCidImages(html, [{ contentId: "known", dataUri: "data:x" }]);
    expect(out).toBe('<img src="cid:unknown">');
  });
});
