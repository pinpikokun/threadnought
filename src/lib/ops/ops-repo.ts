import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import type { TicketStatus, NoteType } from "@/generated/prisma/client";
import type { Actor, AuditEntry, OpResult } from "./types";
import { decideStatusChange } from "./status";
import { decideAssigneeChange } from "./assignee";
import { decideLabelChange } from "./labels";
import { buildTimeline, type TimelineItem } from "./timeline";
import { nextCaseNumber } from "@/lib/tickets/numbering";
import { validateMerge, validateSplit } from "./merge-split";

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
      messages: { select: { id: true, sentAt: true, direction: true, fromAddr: true, subject: true, bodyText: true, bodyHtml: true, attachments: { select: { id: true, filename: true, contentType: true, size: true, inline: true } } } },
      notes: { select: { id: true, occurredAt: true, type: true, body: true, author: { select: { displayName: true } } } },
      audits: { select: { id: true, createdAt: true, action: true, fromValue: true, toValue: true, actor: { select: { displayName: true } } } },
    },
  });
  if (!ticket) return null;

  return buildTimeline({
    messages: ticket.messages.map((m) => ({
      id: m.id, sentAt: m.sentAt, direction: m.direction, fromAddr: m.fromAddr, subject: m.subject, bodyText: m.bodyText, bodyHtml: m.bodyHtml, attachments: m.attachments,
    })),
    notes: ticket.notes.map((n) => ({
      id: n.id, occurredAt: n.occurredAt, type: n.type, authorName: n.author.displayName, body: n.body,
    })),
    audits: ticket.audits.map((a) => ({
      id: a.id, createdAt: a.createdAt, action: a.action, actorName: a.actor.displayName, fromValue: a.fromValue, toValue: a.toValue,
    })),
  });
}

// 統合：source の全メール・全メモを target に移し、source を空にしてゴミ箱化する。
export async function mergeTickets(input: {
  sourceId: string;
  targetId: string;
  actor: Actor;
}): Promise<OpResult> {
  const v = validateMerge({ sourceId: input.sourceId, targetId: input.targetId });
  if (!v.ok) return { kind: "invalid", reason: v.reason };

  const [source, target] = await Promise.all([
    prisma.ticket.findUnique({ where: { id: input.sourceId }, select: { id: true, caseNumber: true, messageCount: true } }),
    prisma.ticket.findUnique({ where: { id: input.targetId }, select: { id: true } }),
  ]);
  if (!source || !target) return { kind: "not_found" };

  await prisma.$transaction(async (tx) => {
    await tx.message.updateMany({ where: { ticketId: input.sourceId }, data: { ticketId: input.targetId } });
    await tx.note.updateMany({ where: { ticketId: input.sourceId }, data: { ticketId: input.targetId } });
    // メッセージ数を実数から再計算（非正規化列の整合を保つ）。
    const targetCount = await tx.message.count({ where: { ticketId: input.targetId } });
    await tx.ticket.update({ where: { id: input.targetId }, data: { messageCount: targetCount } });
    await tx.ticket.update({ where: { id: input.sourceId }, data: { messageCount: 0, isTrashed: true } });
    await writeAudits(tx, input.targetId, input.actor.operatorId, [{ action: "MERGED", fromValue: source.caseNumber, toValue: input.targetId }]);
    await writeAudits(tx, input.sourceId, input.actor.operatorId, [{ action: "MERGED", toValue: input.targetId }]);
  });
  return { kind: "ok", changed: true };
}

// 分割：指定メール1通を、同じ窓口の新規チケットへ切り出す。
export async function splitMessage(input: {
  ticketId: string;
  messageId: string;
  actor: Actor;
}): Promise<{ kind: "ok"; newTicketId: string; caseNumber: string } | Exclude<OpResult, { kind: "ok" }>> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: input.ticketId },
    select: { id: true, accountId: true, account: { select: { casePrefix: true } }, messages: { select: { id: true, subject: true } } },
  });
  if (!ticket) return { kind: "not_found" };

  const v = validateSplit({ ticketMessageIds: ticket.messages.map((m) => m.id), messageId: input.messageId });
  if (!v.ok) return { kind: "invalid", reason: v.reason };

  const target = ticket.messages.find((m) => m.id === input.messageId)!;
  // 採番はトランザクション外（Counterのupsert）。件名は分割元メールの件名を引き継ぐ。
  const caseNumber = await nextCaseNumber(ticket.account.casePrefix);

  const newTicketId = await prisma.$transaction(async (tx) => {
    const created = await tx.ticket.create({
      data: {
        caseNumber, token: caseNumber, title: target.subject, subject: target.subject,
        accountId: ticket.accountId, status: "UNHANDLED", messageCount: 1,
      },
      select: { id: true },
    });
    await tx.message.update({ where: { id: input.messageId }, data: { ticketId: created.id } });
    // 分割元のメッセージ数を実数へ再計算。
    const srcCount = await tx.message.count({ where: { ticketId: input.ticketId } });
    await tx.ticket.update({ where: { id: input.ticketId }, data: { messageCount: srcCount } });
    await writeAudits(tx, input.ticketId, input.actor.operatorId, [{ action: "SPLIT", toValue: caseNumber }]);
    await writeAudits(tx, created.id, input.actor.operatorId, [{ action: "SPLIT", fromValue: ticket.id }]);
    return created.id;
  });
  return { kind: "ok", newTicketId, caseNumber };
}

// チケットの件名・ピン留め・期日を部分更新する。
// 注: これらの編集は現状 AuditLog に記録しない(専用 AuditAction が未整備のため)。
// 監査が必要になった時点で enum 追加(本番マイグレーション)とあわせて writeAudits を足す。
export async function updateTicketFields(input: {
  ticketId: string;
  title?: string;
  isPinned?: boolean;
  dueDate?: string | null; // ISO文字列 or null(=期日クリア)
}): Promise<OpResult> {
  const ticket = await prisma.ticket.findUnique({ where: { id: input.ticketId }, select: { id: true } });
  if (!ticket) return { kind: "not_found" };

  const data: Prisma.TicketUpdateInput = {};
  if (input.title !== undefined) {
    if (input.title.trim() === "") return { kind: "invalid", reason: "件名を入力してください" };
    data.title = input.title.trim();
  }
  if (input.isPinned !== undefined) data.isPinned = input.isPinned;
  if (input.dueDate !== undefined) {
    if (input.dueDate === null || input.dueDate === "") {
      data.dueDate = null;
    } else {
      const d = new Date(input.dueDate);
      if (Number.isNaN(d.getTime())) return { kind: "invalid", reason: "期日の形式が不正です" };
      data.dueDate = d;
    }
  }

  if (Object.keys(data).length === 0) return { kind: "ok", changed: false };
  await prisma.ticket.update({ where: { id: input.ticketId }, data });
  return { kind: "ok", changed: true };
}
