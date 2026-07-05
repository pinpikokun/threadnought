import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";

const PREFIX = "AXMIG";
let accountId = "";
let messageId = "";
let attId = "";

beforeAll(async () => {
  const acc = await prisma.mailAccount.create({ data: { name: "添付移行窓口", casePrefix: `${PREFIX}A`, config: {} } });
  accountId = acc.id;
  const tk = await prisma.ticket.create({
    data: {
      caseNumber: `${PREFIX}A-000001`, token: `${PREFIX}A-000001`, title: "T", subject: "T",
      accountId, messageCount: 1,
      messages: { create: {
        direction: "INBOUND", messageId: `<${PREFIX}-m@x.example>`, references: [],
        fromAddr: "a@x.example", toAddrs: ["s@x.example"], subject: "T", sentAt: new Date("2026-06-26T09:00:00Z"),
      } },
    },
    include: { messages: true },
  });
  messageId = tk.messages[0].id;
});

afterAll(async () => {
  await prisma.attachment.deleteMany({ where: { messageId } });
  await prisma.message.deleteMany({ where: { ticket: { caseNumber: { startsWith: PREFIX } } } });
  await prisma.ticket.deleteMany({ where: { caseNumber: { startsWith: PREFIX } } });
  await prisma.mailAccount.deleteMany({ where: { casePrefix: { startsWith: PREFIX } } });
  await prisma.$disconnect();
});

describe("Attachment schema (contentId / inline)", () => {
  it("inline=true と contentId を保存して読み戻せる", async () => {
    const a = await prisma.attachment.create({
      data: { messageId, filename: "logo.png", contentType: "image/png", storageKey: "k-mig-1", size: 10, contentId: "cid123", inline: true },
    });
    attId = a.id;
    const got = await prisma.attachment.findUnique({ where: { id: attId } });
    expect(got?.inline).toBe(true);
    expect(got?.contentId).toBe("cid123");
  });

  it("inline は既定 false・contentId は既定 null", async () => {
    const a = await prisma.attachment.create({
      data: { messageId, filename: "doc.pdf", contentType: "application/pdf", storageKey: "k-mig-2", size: 20 },
    });
    const got = await prisma.attachment.findUnique({ where: { id: a.id } });
    expect(got?.inline).toBe(false);
    expect(got?.contentId).toBeNull();
  });
});
