import { prisma } from "@/lib/prisma";
import type { EmailAddr } from "./types";
import type { ReplyRepository, ReplyContext } from "./reply";

export const prismaReplyRepository: ReplyRepository = {
  async loadReplyContext(ticketId) {
    const ticket = await prisma.ticket.findUnique({
      where: { id: ticketId },
      select: {
        id: true,
        caseNumber: true,
        subject: true,
        status: true,
        assigneeId: true,
        tokenEnabled: true,
        account: { select: { signature: true, config: true } },
        messages: {
          where: { direction: "INBOUND" },
          orderBy: { sentAt: "desc" },
          take: 1,
          select: { messageId: true, references: true, fromAddr: true, subject: true, sentAt: true, bodyText: true },
        },
      },
    });
    if (!ticket) return null;
    const last = ticket.messages[0];
    if (!last) return null;

    const cfg = (ticket.account.config ?? {}) as { fromAddress?: string; smtp?: { user?: string }; user?: string };
    const fromAddress = cfg.fromAddress ?? cfg.smtp?.user ?? cfg.user ?? "";
    const from: EmailAddr = { address: fromAddress };

    return {
      ticket: {
        id: ticket.id,
        caseNumber: ticket.caseNumber,
        subject: ticket.subject,
        status: ticket.status,
        assigneeId: ticket.assigneeId,
        tokenEnabled: ticket.tokenEnabled ?? true, // null は既定ON
      },
      from,
      signature: ticket.account.signature ?? undefined,
      last: {
        subject: last.subject,
        messageId: last.messageId,
        references: last.references,
        from: { address: last.fromAddr },
        date: last.sentAt,
        text: last.bodyText ?? undefined,
      },
    } satisfies ReplyContext;
  },

  async saveOutbound({ ticketId, operatorId, outgoing, sentMessageId, autoAssign, toInProgress }) {
    return await prisma.$transaction(async (tx) => {
      const msg = await tx.message.create({
        data: {
          ticketId,
          direction: "OUTBOUND",
          messageId: sentMessageId,
          inReplyTo: outgoing.inReplyTo ?? null,
          references: outgoing.references,
          fromAddr: outgoing.from.address,
          toAddrs: outgoing.to.map((t) => t.address),
          subject: outgoing.subject,
          bodyText: outgoing.text,
          bodyHtml: outgoing.html ?? null,
          sentAt: new Date(),
        },
        select: { id: true },
      });
      await tx.ticket.update({
        where: { id: ticketId },
        data: {
          messageCount: { increment: 1 },
          ...(toInProgress ? { status: "IN_PROGRESS" } : {}),
          ...(autoAssign ? { assigneeId: operatorId } : {}),
        },
      });
      await tx.auditLog.create({ data: { ticketId, actorId: operatorId, action: "REPLIED" } });
      if (toInProgress) {
        await tx.auditLog.create({
          data: { ticketId, actorId: operatorId, action: "STATUS_CHANGED", fromValue: "UNHANDLED", toValue: "IN_PROGRESS" },
        });
      }
      if (autoAssign) {
        await tx.auditLog.create({ data: { ticketId, actorId: operatorId, action: "ASSIGNEE_CHANGED", toValue: operatorId } });
      }
      return { messageDbId: msg.id };
    });
  },
};
