import { describe, it, expect } from "vitest";
import { replySubject, applyToken, composeReply, type ComposeReplyInput } from "./reply";

const base: ComposeReplyInput = {
  from: { address: "support@example.com" },
  to: [{ address: "yamada@example.com", name: "山田" }],
  bodyText: "ご連絡ありがとうございます。",
  original: {
    subject: "お問い合わせの件",
    messageId: "<in-1@example.com>",
    references: ["<root@example.com>"],
    from: { address: "yamada@example.com", name: "山田" },
    date: new Date("2026-06-26T10:05:00Z"),
    text: "質問です",
  },
  caseNumber: "SUP-000001",
  tokenEnabled: true,
  signature: "-- サポート窓口",
  includeQuote: true,
};

describe("replySubject", () => {
  it("Re: を付与、既にあれば重複させない", () => {
    expect(replySubject("お問い合わせ")).toBe("Re: お問い合わせ");
    expect(replySubject("Re: お問い合わせ")).toBe("Re: お問い合わせ");
    expect(replySubject("RE: x")).toBe("RE: x");
  });
});

describe("applyToken", () => {
  it("有効かつ未含有なら付与、含有済み/無効なら変更しない", () => {
    expect(applyToken("Re: x", "SUP-000001", true)).toBe("Re: x [SUP-000001]");
    expect(applyToken("Re: x [SUP-000001]", "SUP-000001", true)).toBe("Re: x [SUP-000001]");
    expect(applyToken("Re: x", "SUP-000001", false)).toBe("Re: x");
  });
});

describe("composeReply", () => {
  it("件名・ヘッダ・本文（本文+署名+引用）を組み立てる", () => {
    const out = composeReply(base);
    expect(out.subject).toBe("Re: お問い合わせの件 [SUP-000001]");
    expect(out.inReplyTo).toBe("<in-1@example.com>");
    expect(out.references).toEqual(["<root@example.com>", "<in-1@example.com>"]);
    expect(out.text).toBe(
      "ご連絡ありがとうございます。\n\n-- サポート窓口\n\nOn 2026-06-26 10:05 UTC, 山田 <yamada@example.com> wrote:\n> 質問です",
    );
  });

  it("includeQuote=false なら引用を付けない、署名なしも可", () => {
    const out = composeReply({ ...base, includeQuote: false, signature: undefined });
    expect(out.text).toBe("ご連絡ありがとうございます。");
  });
});
