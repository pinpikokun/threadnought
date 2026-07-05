import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { nextCaseNumber } from "@/lib/tickets/numbering";
import { storage, attachmentMaxBytes } from "@/lib/storage";
import type { IngestRepository, ParsedEmail } from "./types";

function messageData(email: ParsedEmail) {
  return {
    direction: "INBOUND" as const,
    messageId: email.messageId,
    inReplyTo: email.inReplyTo ?? null,
    references: email.references,
    fromAddr: email.from.address,
    toAddrs: email.to.map((t) => t.address),
    subject: email.subject,
    bodyText: email.text ?? null,
    bodyHtml: email.html ?? null,
    rawSource: email.raw ?? null,
    sentAt: email.date,
  };
}

// 添付実体をストレージへ保存し、Message にネストする Attachment.create 配列を返す。
// 上限超過分は保存せずスキップ（警告ログ）。DBトランザクション開始前に呼ぶこと。
async function attachmentCreates(email: ParsedEmail) {
  const max = attachmentMaxBytes();
  const out: { filename: string; contentType: string; storageKey: string; size: number; contentId: string | null; inline: boolean }[] = [];
  for (const a of email.attachments ?? []) {
    if (a.size > max) {
      console.warn(`[ingest] 添付をスキップ(サイズ超過 ${a.size}B > ${max}B): ${a.filename}`);
      continue;
    }
    const storageKey = crypto.randomUUID();
    await storage.put(storageKey, a.content);
    out.push({
      filename: a.filename,
      contentType: a.contentType,
      storageKey,
      size: a.size,
      contentId: a.contentId ?? null,
      inline: a.inline,
    });
  }
  return out;
}

export const prismaIngestRepository: IngestRepository = {
  async findTicketIdByMessageId(messageId) {
    const m = await prisma.message.findUnique({ where: { messageId }, select: { ticketId: true } });
    return m?.ticketId ?? null;
  },
  async ticketIdByMessageIds(ids) {
    const m = await prisma.message.findFirst({ where: { messageId: { in: ids } }, select: { ticketId: true } });
    return m?.ticketId ?? null;
  },
  async ticketIdByCaseNumber(caseNumber) {
    const t = await prisma.ticket.findUnique({ where: { caseNumber }, select: { id: true } });
    return t?.id ?? null;
  },
  nextCaseNumber,
  async createTicketWithInbound({ accountId, caseNumber, email }) {
    const attachments = await attachmentCreates(email);
    const t = await prisma.ticket.create({
      data: {
        caseNumber, token: caseNumber, title: email.subject, subject: email.subject,
        accountId, messageCount: 1,
        messages: { create: { ...messageData(email), attachments: { create: attachments } } },
      },
      select: { id: true },
    });
    return { ticketId: t.id };
  },
  async appendInbound({ ticketId, email }) {
    const attachments = await attachmentCreates(email);
    return await prisma.$transaction(async (tx) => {
      const t = await tx.ticket.findUnique({ where: { id: ticketId }, select: { status: true } });
      const reopened = t?.status === "DONE";
      await tx.message.create({ data: { ...messageData(email), ticketId, attachments: { create: attachments } } });
      await tx.ticket.update({
        where: { id: ticketId },
        data: { messageCount: { increment: 1 }, ...(reopened ? { status: "IN_PROGRESS" } : {}) },
      });
      if (reopened) {
        await tx.auditLog.create({ data: { ticketId, actorId: await systemActorId(tx), action: "REOPENED", fromValue: "DONE", toValue: "IN_PROGRESS" } });
      }
      return { reopened };
    });
  },
};

// AuditLog.actorId は必須。受信由来は「システム」担当を1件用意して使う。
async function systemActorId(tx: Prisma.TransactionClient): Promise<string> {
  const username = "system";
  const op = await tx.operator.upsert({
    where: { username },
    create: { username, displayName: "システム", passwordHash: "-", isActive: false },
    update: {},
    select: { id: true },
  });
  return op.id;
}
