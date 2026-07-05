import { describe, it, expect } from "vitest";
import { buildQuoteText } from "./quote";

describe("buildQuoteText", () => {
  it("引用ヘッダと各行 > プレフィックスを生成（名前あり）", () => {
    const out = buildQuoteText({
      from: { address: "yamada@example.com", name: "山田" },
      date: new Date("2026-06-26T10:05:00Z"),
      text: "1行目\n2行目",
    });
    expect(out).toBe("On 2026-06-26 10:05 UTC, 山田 <yamada@example.com> wrote:\n> 1行目\n> 2行目");
  });

  it("名前が無ければアドレスのみ、本文無しは空引用", () => {
    const out = buildQuoteText({ from: { address: "a@b.com" }, date: new Date("2026-01-02T03:04:00Z") });
    expect(out).toBe("On 2026-01-02 03:04 UTC, a@b.com wrote:\n> ");
  });
});
