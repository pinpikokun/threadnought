import { describe, it, expect } from "vitest";
import { sendReply, type ReplyContext } from "./reply";
import { FakeMailSender, FakeReplyRepository } from "./fakes";

function ctx(over: Partial<ReplyContext["ticket"]> = {}): ReplyContext {
  return {
    ticket: { id: "T1", caseNumber: "SUP-000001", subject: "お問い合わせの件", status: "UNHANDLED", assigneeId: null, tokenEnabled: true, ...over },
    from: { address: "support@example.com" },
    signature: "-- 窓口",
    last: {
      subject: "お問い合わせの件",
      messageId: "<in-1@example.com>",
      references: [],
      from: { address: "yamada@example.com", name: "山田" },
      date: new Date("2026-06-26T10:05:00Z"),
      text: "質問です",
    },
  };
}

describe("sendReply", () => {
  it("コンテキストが無ければ not_found", async () => {
    const res = await sendReply({ ticketId: "X", operatorId: "op1", bodyText: "本文" }, { repo: new FakeReplyRepository(null), sender: new FakeMailSender() });
    expect(res).toEqual({ kind: "not_found" });
  });

  it("送信し、宛先は既定で元差出人、未対応→対応中・未割当→自動担当を要求する", async () => {
    const sender = new FakeMailSender();
    const repo = new FakeReplyRepository(ctx());
    const res = await sendReply({ ticketId: "T1", operatorId: "op1", bodyText: "ご連絡ありがとうございます。" }, { repo, sender });

    expect(res.kind).toBe("sent");
    // 送信内容
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0].to).toEqual([{ address: "yamada@example.com", name: "山田" }]);
    expect(sender.sent[0].subject).toBe("Re: お問い合わせの件 [SUP-000001]");
    expect(sender.sent[0].inReplyTo).toBe("<in-1@example.com>");
    // 永続化の要求
    expect(repo.saved).toHaveLength(1);
    expect(repo.saved[0].toInProgress).toBe(true);
    expect(repo.saved[0].autoAssign).toBe(true);
    expect(repo.saved[0].sentMessageId).toBe("<out-1@threadnought.local>"); // FakeMailSender が返した ID を保存
    expect(repo.saved[0].operatorId).toBe("op1");
  });

  it("担当済み・対応中なら自動担当もステータス変更も要求しない、宛先/引用は指定に従う", async () => {
    const sender = new FakeMailSender();
    const repo = new FakeReplyRepository(ctx({ status: "IN_PROGRESS", assigneeId: "op9" }));
    await sendReply(
      { ticketId: "T1", operatorId: "op1", bodyText: "本文", to: [{ address: "other@example.com" }], includeQuote: false },
      { repo, sender },
    );
    expect(sender.sent[0].to).toEqual([{ address: "other@example.com" }]);
    expect(sender.sent[0].text).toBe("本文\n\n-- 窓口"); // 引用なし
    expect(repo.saved[0].toInProgress).toBe(false);
    expect(repo.saved[0].autoAssign).toBe(false);
  });
});
