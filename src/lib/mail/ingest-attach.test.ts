import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { prismaIngestRepository } from "./ingest-repo";
import { storage } from "@/lib/storage";
import type { ParsedEmail } from "./types";

const PREFIX = "AXING";
let accountId = "";
const createdKeys: string[] = [];

function emailWith(attachments: ParsedEmail["attachments"], n: number): ParsedEmail {
  return {
    uid: `${n}`, messageId: `<${PREFIX}-${n}@x.example>`, references: [],
    from: { address: "a@x.example" }, to: [{ address: "s@x.example" }],
    subject: "添付テスト", text: "本文", date: new Date("2026-06-26T09:00:00Z"),
    attachments,
  };
}

beforeAll(async () => {
  const acc = await prisma.mailAccount.create({ data: { name: "添付取込窓口", casePrefix: `${PREFIX}A`, config: {} } });
  accountId = acc.id;
});

afterAll(async () => {
  for (const k of createdKeys) await storage.delete(k);
  await prisma.attachment.deleteMany({ where: { message: { ticket: { caseNumber: { startsWith: PREFIX } } } } });
  await prisma.message.deleteMany({ where: { ticket: { caseNumber: { startsWith: PREFIX } } } });
  await prisma.ticket.deleteMany({ where: { caseNumber: { startsWith: PREFIX } } });
  await prisma.mailAccount.deleteMany({ where: { casePrefix: { startsWith: PREFIX } } });
  await prisma.$disconnect();
});

describe("prismaIngestRepository 添付保存", () => {
  it("新規チケット作成時に添付を保存し実体を取り出せる", async () => {
    const email = emailWith([
      { filename: "a.txt", contentType: "text/plain", content: Buffer.from("hello-attach"), size: 12, inline: false },
      { filename: "logo.png", contentType: "image/png", content: Buffer.from("imgdata"), size: 7, contentId: "cid9", inline: true },
    ], 1);
    const { ticketId } = await prismaIngestRepository.createTicketWithInbound({ accountId, caseNumber: `${PREFIX}A-000001`, email });

    const msg = await prisma.message.findFirst({ where: { ticketId }, include: { attachments: true } });
    expect(msg?.attachments).toHaveLength(2);
    for (const at of msg!.attachments) createdKeys.push(at.storageKey);

    const txt = msg!.attachments.find((a) => a.filename === "a.txt")!;
    expect(txt.inline).toBe(false);
    const blob = await storage.get(txt.storageKey);
    expect(blob.toString()).toBe("hello-attach");

    const png = msg!.attachments.find((a) => a.filename === "logo.png")!;
    expect(png.inline).toBe(true);
    expect(png.contentId).toBe("cid9");
  });

  it("上限超過の添付はスキップされる", async () => {
    process.env.ATTACHMENT_MAX_BYTES = "5";
    try {
      const email = emailWith([
        { filename: "big.bin", contentType: "application/octet-stream", content: Buffer.from("0123456789"), size: 10, inline: false },
        { filename: "ok.bin", contentType: "application/octet-stream", content: Buffer.from("abc"), size: 3, inline: false },
      ], 2);
      const { ticketId } = await prismaIngestRepository.createTicketWithInbound({ accountId, caseNumber: `${PREFIX}A-000002`, email });
      const msg = await prisma.message.findFirst({ where: { ticketId }, include: { attachments: true } });
      expect(msg?.attachments).toHaveLength(1);
      expect(msg?.attachments[0].filename).toBe("ok.bin");
      for (const at of msg!.attachments) createdKeys.push(at.storageKey);
    } finally {
      delete process.env.ATTACHMENT_MAX_BYTES;
    }
  });
});
