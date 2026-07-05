import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { assertAttachmentAccess } from "./access";

const PREFIX = "AXACC";
let accountA = "";
let accountB = "";
let attInA = "";

beforeAll(async () => {
  const a = await prisma.mailAccount.create({ data: { name: "添付窓口A", casePrefix: `${PREFIX}A`, config: {} } });
  const b = await prisma.mailAccount.create({ data: { name: "添付窓口B", casePrefix: `${PREFIX}B`, config: {} } });
  accountA = a.id;
  accountB = b.id;
  const tk = await prisma.ticket.create({
    data: {
      caseNumber: `${PREFIX}A-000001`, token: `${PREFIX}A-000001`, title: "T", subject: "T",
      accountId: accountA, messageCount: 1,
      messages: { create: {
        direction: "INBOUND", messageId: `<${PREFIX}-m@x.example>`, references: [],
        fromAddr: "a@x.example", toAddrs: ["s@x.example"], subject: "T", sentAt: new Date("2026-06-26T09:00:00Z"),
        attachments: { create: { filename: "a.txt", contentType: "text/plain", storageKey: "k-acc-1", size: 3, inline: false } },
      } },
    },
    include: { messages: { include: { attachments: true } } },
  });
  attInA = tk.messages[0].attachments[0].id;
});

afterAll(async () => {
  await prisma.attachment.deleteMany({ where: { message: { ticket: { caseNumber: { startsWith: PREFIX } } } } });
  await prisma.message.deleteMany({ where: { ticket: { caseNumber: { startsWith: PREFIX } } } });
  await prisma.ticket.deleteMany({ where: { caseNumber: { startsWith: PREFIX } } });
  await prisma.mailAccount.deleteMany({ where: { casePrefix: { startsWith: PREFIX } } });
  await prisma.$disconnect();
});

describe("assertAttachmentAccess", () => {
  it("窓口を持つMEMBERは ok と添付メタを得る", async () => {
    const r = await assertAttachmentAccess({ role: "MEMBER", accountIds: [accountA] }, attInA);
    expect(r.result).toBe("ok");
    expect(r.attachment?.filename).toBe("a.txt");
  });

  it("別窓口しか持たないMEMBERは forbidden", async () => {
    const r = await assertAttachmentAccess({ role: "MEMBER", accountIds: [accountB] }, attInA);
    expect(r.result).toBe("forbidden");
    expect(r.attachment).toBeNull();
  });

  it("accountIds が空の非ADMINは forbidden(fail-closed)", async () => {
    const r = await assertAttachmentAccess({ role: "MEMBER", accountIds: [] }, attInA);
    expect(r.result).toBe("forbidden");
  });

  it("ADMINは全窓口で ok", async () => {
    const r = await assertAttachmentAccess({ role: "ADMIN", accountIds: [] }, attInA);
    expect(r.result).toBe("ok");
  });

  it("存在しない添付は not_found", async () => {
    const r = await assertAttachmentAccess({ role: "ADMIN", accountIds: [] }, "no-such-id");
    expect(r.result).toBe("not_found");
    expect(r.attachment).toBeNull();
  });
});
