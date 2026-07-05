import { describe, it, expect } from "vitest";
import { toNodemailerMessage } from "./smtp";

describe("toNodemailerMessage", () => {
  it("OutgoingEmail を nodemailer メッセージ形へマップする", () => {
    const msg = toNodemailerMessage({
      from: { address: "support@example.com", name: "窓口" },
      to: [{ address: "a@example.com", name: "顧客A" }, { address: "b@example.com" }],
      cc: [{ address: "cc@example.com" }],
      subject: "Re: 件名 [SUP-000001]",
      text: "本文",
      inReplyTo: "<in-1@example.com>",
      references: ["<root@example.com>", "<in-1@example.com>"],
    });
    expect(msg.from).toBe('"窓口" <support@example.com>');
    expect(msg.to).toEqual(['"顧客A" <a@example.com>', "b@example.com"]);
    expect(msg.cc).toEqual(["cc@example.com"]);
    expect(msg.subject).toBe("Re: 件名 [SUP-000001]");
    expect(msg.inReplyTo).toBe("<in-1@example.com>");
    expect(msg.references).toBe("<root@example.com> <in-1@example.com>");
  });
});
