import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { prismaReplyRepository } from "./reply-repo";
import { sendReply } from "./reply";
import { FakeMailSender } from "./fakes";

const PREFIX = "RT"; // reply-test 専用の接頭辞
let accountId = "";
let operatorId = "";
let ticketId = "";

beforeAll(async () => {
  const account = await prisma.mailAccount.create({
    data: { name: "返信テスト窓口", casePrefix: PREFIX, signature: "-- 返信テスト窓口", config: { fromAddress: "support@example.com" } },
  });
  accountId = account.id;
  const op = await prisma.operator.create({
    data: { username: `reply-test-${PREFIX}`, displayName: "返信担当", passwordHash: "x", role: "MEMBER" },
  });
  operatorId = op.id;
  const ticket = await prisma.ticket.create({
    data: {
      caseNumber: `${PREFIX}-000001`, token: `${PREFIX}-000001`, title: "返信テスト", subject: "返信テストの件",
      accountId, status: "UNHANDLED", messageCount: 1,
      messages: {
        create: {
          direction: "INBOUND", messageId: `<reply-test-in@example.com>`, references: [],
          fromAddr: "customer@example.com", toAddrs: ["support@example.com"], subject: "返信テストの件",
          bodyText: "質問があります", sentAt: new Date("2026-06-26T10:00:00Z"),
        },
      },
    },
  });
  ticketId = ticket.id;
});

afterAll(async () => {
  // FK 依存順に削除
  await prisma.auditLog.deleteMany({ where: { ticketId } });
  await prisma.message.deleteMany({ where: { ticketId } });
  await prisma.ticket.delete({ where: { id: ticketId } });
  await prisma.operator.delete({ where: { id: operatorId } });
  await prisma.mailAccount.delete({ where: { id: accountId } });
  await prisma.$disconnect();
});

describe("prismaReplyRepository + sendReply（統合）", () => {
  it("返信を保存し、OUTBOUND作成・対応中化・自動担当・監査を確定する", async () => {
    const sender = new FakeMailSender();
    const res = await sendReply(
      { ticketId, operatorId, bodyText: "ご連絡ありがとうございます。" },
      { repo: prismaReplyRepository, sender },
    );
    expect(res.kind).toBe("sent");

    const outbound = await prisma.message.findFirst({ where: { ticketId, direction: "OUTBOUND" } });
    expect(outbound).not.toBeNull();
    expect(outbound!.subject).toBe("Re: 返信テストの件 [RT-000001]");
    expect(outbound!.inReplyTo).toBe("<reply-test-in@example.com>");
    expect(outbound!.fromAddr).toBe("support@example.com");

    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    expect(ticket!.status).toBe("IN_PROGRESS");
    expect(ticket!.assigneeId).toBe(operatorId);
    expect(ticket!.messageCount).toBe(2);

    const replied = await prisma.auditLog.findFirst({ where: { ticketId, action: "REPLIED" } });
    expect(replied).not.toBeNull();
  });
});
