import { describe, it, expect } from "vitest";
import { FakeMailSender } from "./fakes";

describe("FakeMailSender", () => {
  it("送信内容を記録し、一意な Message-ID を返す", async () => {
    const sender = new FakeMailSender();
    const r1 = await sender.send({ from: { address: "s@x.com" }, to: [{ address: "c@x.com" }], subject: "Re: 件名", text: "本文", references: [] });
    const r2 = await sender.send({ from: { address: "s@x.com" }, to: [{ address: "c@x.com" }], subject: "Re: 件名2", text: "本文2", references: [] });
    expect(sender.sent).toHaveLength(2);
    expect(sender.sent[0].subject).toBe("Re: 件名");
    expect(r1.messageId).not.toBe(r2.messageId);
    expect(r1.messageId).toMatch(/@threadnought\.local>$/);
  });
});
