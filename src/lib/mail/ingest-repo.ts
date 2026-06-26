import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { nextCaseNumber } from "@/lib/tickets/numbering";
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
    const t = await prisma.ticket.create({
      data: {
        caseNumber, token: caseNumber, title: email.subject, subject: email.subject,
        accountId, messageCount: 1,
        messages: { create: messageData(email) },
      },
      select: { id: true },
    });
    return { ticketId: t.id };
  },
  async appendInbound({ ticketId, email }) {
    return await prisma.$transaction(async (tx) => {
      const t = await tx.ticket.findUnique({ where: { id: ticketId }, select: { status: true } });
      const reopened = t?.status === "DONE";
      await tx.message.create({ data: { ...messageData(email), ticketId } });
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
