import { describe, it, expect } from "vitest";
import { prepareHtmlBody } from "./html-view";

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
    expect(out).toContain("img-src 'none'");
  });
});
