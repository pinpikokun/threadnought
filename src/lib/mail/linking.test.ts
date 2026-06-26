import { describe, it, expect } from "vitest";
import { findParentTicketId } from "./linking";
import { makeEmail } from "./fakes";

const baseRepo = {
  async ticketIdByMessageIds() { return null; },
  async ticketIdByCaseNumber() { return null; },
};

describe("findParentTicketId", () => {
  it("In-Reply-To/References が既存メッセージに一致したらそのチケット", async () => {
    const repo = { ...baseRepo, async ticketIdByMessageIds() { return "T1"; } };
    const email = makeEmail({ messageId: "<b@x>", inReplyTo: "<a@x>", references: ["<a@x>"] });
    expect(await findParentTicketId(email, repo)).toBe("T1");
  });
  it("参照が無ければ件名トークンで特定する", async () => {
    const repo = { ...baseRepo, async ticketIdByCaseNumber(cn: string) { return cn === "SUP-000042" ? "T2" : null; } };
    const email = makeEmail({ messageId: "<c@x>", subject: "Re: 件名 [SUP-000042]" });
    expect(await findParentTicketId(email, repo)).toBe("T2");
  });
  it("件名が同じだけ（番号なし）では紐づけず null（=新規）", async () => {
    const email = makeEmail({ messageId: "<d@x>", subject: "Re: お問い合わせの件" });
    expect(await findParentTicketId(email, baseRepo)).toBeNull();
  });
});
