import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { TicketStatus, NoteType } from "@/generated/prisma/client";
import type { Actor, AuditEntry, OpResult } from "./types";
import { decideStatusChange } from "./status";
import { decideAssigneeChange } from "./assignee";
import { decideLabelChange } from "./labels";
import { buildTimeline, type TimelineItem } from "./timeline";

// audits を AuditLog 行としてまとめて書き込む。
export async function writeAudits(
  tx: Prisma.TransactionClient,
  ticketId: string,
  actorId: string,
  audits: AuditEntry[],
): Promise<void> {
  for (const a of audits) {
    await tx.auditLog.create({
      data: { ticketId, actorId, action: a.action, fromValue: a.fromValue ?? null, toValue: a.toValue ?? null },
    });
  }
}

export async function changeStatus(input: {
  ticketId: string;
  actor: Actor;
  status: TicketStatus;
}): Promise<OpResult> {
  const ticket = await prisma.ticket.findUnique({ where: { id: input.ticketId }, select: { status: true } });
  if (!ticket) return { kind: "not_found" };

  const decision = decideStatusChange({ current: ticket.status, requested: input.status });
  if (decision.kind === "noop") return { kind: "ok", changed: false };
  if (decision.kind === "forbidden") return { kind: "forbidden" };
  if (decision.kind === "invalid") return { kind: "invalid", reason: decision.reason };

  await prisma.$transaction(async (tx) => {
    await tx.ticket.update({ where: { id: input.ticketId }, data: decision.patch });
    await writeAudits(tx, input.ticketId, input.actor.operatorId, decision.audits);
  });
  return { kind: "ok", changed: true };
}

export async function changeAssignee(input: {
  ticketId: string;
  actor: Actor;
  assigneeId: string | null;
}): Promise<OpResult> {
  const ticket = await prisma.ticket.findUnique({ where: { id: input.ticketId }, select: { assigneeId: true } });
  if (!ticket) return { kind: "not_found" };

  // 担当解除でない場合、対象オペレータの存在と有効性を検証（無効ユーザーは新規担当にしない）。
  if (input.assigneeId != null) {
    const target = await prisma.operator.findUnique({ where: { id: input.assigneeId }, select: { isActive: true } });
    if (!target) return { kind: "invalid", reason: "対象の担当者が存在しません" };
    if (!target.isActive) return { kind: "invalid", reason: "無効な担当者は割り当てできません" };
  }

  const decision = decideAssigneeChange({
    actor: input.actor,
    currentAssigneeId: ticket.assigneeId,
    targetOperatorId: input.assigneeId,
  });
  if (decision.kind === "noop") return { kind: "ok", changed: false };
  if (decision.kind === "forbidden") return { kind: "forbidden" };
  if (decision.kind === "invalid") return { kind: "invalid", reason: decision.reason };

  await prisma.$transaction(async (tx) => {
    await tx.ticket.update({ where: { id: input.ticketId }, data: decision.patch });
    await writeAudits(tx, input.ticketId, input.actor.operatorId, decision.audits);
  });
  return { kind: "ok", changed: true };
}

export async function changeLabel(input: {
  ticketId: string;
  actor: Actor;
  op: "add" | "remove";
  labelId: string;
}): Promise<OpResult> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: input.ticketId },
    select: { labels: { select: { id: true } } },
  });
  if (!ticket) return { kind: "not_found" };

  const label = await prisma.label.findUnique({ where: { id: input.labelId }, select: { id: true } });
  if (!label) return { kind: "invalid", reason: "ラベルが存在しません" };

  const decision = decideLabelChange({
    currentLabelIds: ticket.labels.map((l) => l.id),
    op: input.op,
    labelId: input.labelId,
  });
  if (decision.kind === "noop") return { kind: "ok", changed: false };
  if (decision.kind === "forbidden") return { kind: "forbidden" };
  if (decision.kind === "invalid") return { kind: "invalid", reason: decision.reason };

  await prisma.$transaction(async (tx) => {
    await tx.ticket.update({
      where: { id: input.ticketId },
      data: {
        labels: decision.patch.op === "add"
          ? { connect: { id: decision.patch.labelId } }
          : { disconnect: { id: decision.patch.labelId } },
      },
    });
    await writeAudits(tx, input.ticketId, input.actor.operatorId, decision.audits);
  });
  return { kind: "ok", changed: true };
}

export async function addNote(input: {
  ticketId: string;
  actor: Actor;
  type: NoteType;
  body: string;
}): Promise<OpResult> {
  if (input.body.trim() === "") return { kind: "invalid", reason: "本文が空です" };
  const ticket = await prisma.ticket.findUnique({ where: { id: input.ticketId }, select: { id: true } });
  if (!ticket) return { kind: "not_found" };

  await prisma.note.create({
    data: { ticketId: input.ticketId, type: input.type, authorId: input.actor.operatorId, body: input.body },
  });
  return { kind: "ok", changed: true };
}

export async function loadTimeline(ticketId: string): Promise<TimelineItem[] | null> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      messages: { select: { id: true, sentAt: true, direction: true, fromAddr: true, subject: true, bodyText: true } },
      notes: { select: { id: true, occurredAt: true, type: true, body: true, author: { select: { displayName: true } } } },
      audits: { select: { id: true, createdAt: true, action: true, fromValue: true, toValue: true, actor: { select: { displayName: true } } } },
    },
  });
  if (!ticket) return null;

  return buildTimeline({
    messages: ticket.messages.map((m) => ({
      id: m.id, sentAt: m.sentAt, direction: m.direction, fromAddr: m.fromAddr, subject: m.subject, bodyText: m.bodyText,
    })),
    notes: ticket.notes.map((n) => ({
      id: n.id, occurredAt: n.occurredAt, type: n.type, authorName: n.author.displayName, body: n.body,
    })),
    audits: ticket.audits.map((a) => ({
      id: a.id, createdAt: a.createdAt, action: a.action, actorName: a.actor.displayName, fromValue: a.fromValue, toValue: a.toValue,
    })),
  });
}
