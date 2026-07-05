import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { loadTicketDetail } from "./ticket-detail";

const PREFIX = "TDVWA";
let accountId = "";
let ticketId = "";

beforeAll(async () => {
  const acc = await prisma.mailAccount.create({ data: { name: "詳細窓口", casePrefix: `${PREFIX}A`, config: {} } });
  accountId = acc.id;
  const op = await prisma.operator.create({ data: { username: `detail-${PREFIX}`, displayName: "担当花子", passwordHash: "x", role: "MEMBER" } });
  const label = await prisma.label.create({ data: { name: `重要${PREFIX}`, color: "#f00" } });
  const ticket = await prisma.ticket.create({
    data: {
      caseNumber: `${PREFIX}A-000001`, token: `${PREFIX}A-000001`, title: "詳細タイトル", subject: "詳細件名",
      accountId, status: "IN_PROGRESS", messageCount: 1, assigneeId: op.id,
      labels: { connect: { id: label.id } },
    },
  });
  ticketId = ticket.id;
  const msg = await prisma.message.create({
    data: {
      ticketId, direction: "INBOUND", messageId: `${PREFIX}-msg-1@x.com`,
      fromAddr: "c@x.com", toAddrs: ["s@x.com"], subject: "詳細件名",
      bodyText: "テキスト本文", bodyHtml: "<p>HTML本文</p>", sentAt: new Date("2026-07-06T00:00:00Z"),
    },
  });
  await prisma.attachment.create({
    data: { messageId: msg.id, filename: "doc.pdf", contentType: "application/pdf", storageKey: `${PREFIX}-key-1`, size: 2048, inline: false },
  });
});

afterAll(async () => {
  await prisma.attachment.deleteMany({ where: { storageKey: { startsWith: `${PREFIX}-` } } });
  await prisma.message.deleteMany({ where: { messageId: { startsWith: `${PREFIX}-` } } });
  const tk = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { id: true } });
  if (tk) await prisma.ticket.update({ where: { id: ticketId }, data: { labels: { set: [] } } });
  await prisma.ticket.deleteMany({ where: { caseNumber: { startsWith: PREFIX } } });
  await prisma.label.deleteMany({ where: { name: { startsWith: `重要${PREFIX}` } } });
  await prisma.operator.deleteMany({ where: { username: { startsWith: `detail-${PREFIX}` } } });
  await prisma.mailAccount.deleteMany({ where: { casePrefix: { startsWith: PREFIX } } });
  await prisma.$disconnect();
});

describe("loadTicketDetail", () => {
  it("ヘッダーをまとめて返す", async () => {
    const d = await loadTicketDetail(ticketId);
    expect(d).not.toBeNull();
    expect(d!.header.caseNumber).toBe(`${PREFIX}A-000001`);
    expect(d!.header.title).toBe("詳細タイトル");
    expect(d!.header.status).toBe("IN_PROGRESS");
    expect(d!.header.assigneeName).toBe("担当花子");
    expect(d!.header.accountName).toBe("詳細窓口");
    expect(d!.header.labels.map((l) => l.name)).toContain(`重要${PREFIX}`);
  });

  it("メッセージに bodyHtml と添付が載る", async () => {
    const d = await loadTicketDetail(ticketId);
    const msg = d!.timeline.find((i) => i.kind === "message");
    expect(msg).toBeDefined();
    if (msg && msg.kind === "message") {
      expect(msg.bodyHtml).toBe("<p>HTML本文</p>");
      expect(msg.attachments).toHaveLength(1);
      expect(msg.attachments[0].filename).toBe("doc.pdf");
      expect(msg.attachments[0].size).toBe(2048);
    }
  });

  it("存在しないIDは null", async () => {
    const d = await loadTicketDetail("nonexistent-id-xyz");
    expect(d).toBeNull();
  });
});
