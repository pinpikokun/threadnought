import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { changeStatus, changeAssignee, changeLabel, addNote, loadTimeline } from "./ops-repo";
import type { Actor } from "./types";

const PREFIX = "OP"; // ops-test 専用の接頭辞
let accountId = "";
let adminId = "";
let memberId = "";
let labelId = "";
let ticketId = "";
let admin: Actor;
let member: Actor;

beforeAll(async () => {
  const account = await prisma.mailAccount.create({
    data: { name: "運用テスト窓口", casePrefix: PREFIX, config: {} },
  });
  accountId = account.id;
  const a = await prisma.operator.create({ data: { username: `ops-admin-${PREFIX}`, displayName: "管理者", passwordHash: "x", role: "ADMIN" } });
  const m = await prisma.operator.create({ data: { username: `ops-member-${PREFIX}`, displayName: "担当者", passwordHash: "x", role: "MEMBER" } });
  adminId = a.id; memberId = m.id;
  admin = { operatorId: adminId, role: "ADMIN" };
  member = { operatorId: memberId, role: "MEMBER" };
  const label = await prisma.label.create({ data: { name: "重要", color: "#f00" } });
  labelId = label.id;
  const ticket = await prisma.ticket.create({
    data: {
      caseNumber: `${PREFIX}-000001`, token: `${PREFIX}-000001`, title: "運用テスト", subject: "運用テストの件",
      accountId, status: "UNHANDLED", messageCount: 1,
      messages: { create: {
        direction: "INBOUND", messageId: `<ops-test-in@example.com>`, references: [],
        fromAddr: "customer@example.com", toAddrs: ["support@example.com"], subject: "運用テストの件",
        bodyText: "問い合わせ本文", sentAt: new Date("2026-06-26T09:00:00Z"),
      } },
    },
  });
  ticketId = ticket.id;
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { ticketId } });
  await prisma.note.deleteMany({ where: { ticketId } });
  await prisma.message.deleteMany({ where: { ticketId } });
  await prisma.ticket.update({ where: { id: ticketId }, data: { labels: { set: [] } } });
  await prisma.ticket.delete({ where: { id: ticketId } });
  await prisma.label.delete({ where: { id: labelId } });
  await prisma.operator.delete({ where: { id: adminId } });
  await prisma.operator.delete({ where: { id: memberId } });
  await prisma.mailAccount.delete({ where: { id: accountId } });
  await prisma.$disconnect();
});

describe("ops-repo（統合）", () => {
  it("ステータス変更でチケット更新＋STATUS_CHANGED監査", async () => {
    const res = await changeStatus({ ticketId, actor: admin, status: "DONE" });
    expect(res).toEqual({ kind: "ok", changed: true });
    const t = await prisma.ticket.findUnique({ where: { id: ticketId } });
    expect(t!.status).toBe("DONE");
    const audit = await prisma.auditLog.findFirst({ where: { ticketId, action: "STATUS_CHANGED" }, orderBy: { createdAt: "desc" } });
    expect(audit!.toValue).toBe("DONE");
  });

  it("完了からの変更は REOPENED も記録", async () => {
    const res = await changeStatus({ ticketId, actor: admin, status: "IN_PROGRESS" });
    expect(res).toEqual({ kind: "ok", changed: true });
    const reopened = await prisma.auditLog.findFirst({ where: { ticketId, action: "REOPENED" } });
    expect(reopened).not.toBeNull();
  });

  it("MEMBER が他人へ割り当てると forbidden（DBは不変）", async () => {
    const res = await changeAssignee({ ticketId, actor: member, assigneeId: adminId });
    expect(res).toEqual({ kind: "forbidden" });
    const t = await prisma.ticket.findUnique({ where: { id: ticketId } });
    expect(t!.assigneeId).toBeNull();
  });

  it("MEMBER が自分へ割り当てると成功＋ASSIGNEE_CHANGED監査", async () => {
    const res = await changeAssignee({ ticketId, actor: member, assigneeId: memberId });
    expect(res).toEqual({ kind: "ok", changed: true });
    const t = await prisma.ticket.findUnique({ where: { id: ticketId } });
    expect(t!.assigneeId).toBe(memberId);
    const audit = await prisma.auditLog.findFirst({ where: { ticketId, action: "ASSIGNEE_CHANGED" } });
    expect(audit!.toValue).toBe(memberId);
  });

  it("存在しない担当者は invalid", async () => {
    const res = await changeAssignee({ ticketId, actor: admin, assigneeId: "no-such-op" });
    expect(res).toEqual({ kind: "invalid", reason: "対象の担当者が存在しません" });
  });

  it("ラベル add で connect＋LABEL_ADDED、二度目は noop", async () => {
    const first = await changeLabel({ ticketId, actor: admin, op: "add", labelId });
    expect(first).toEqual({ kind: "ok", changed: true });
    const t = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { labels: { select: { id: true } } } });
    expect(t!.labels.map((l) => l.id)).toContain(labelId);
    const again = await changeLabel({ ticketId, actor: admin, op: "add", labelId });
    expect(again).toEqual({ kind: "ok", changed: false });
    const added = await prisma.auditLog.findFirst({ where: { ticketId, action: "LABEL_ADDED" } });
    expect(added!.toValue).toBe(labelId);
  });

  it("メモ追加でNoteが作られる（空本文は invalid）", async () => {
    expect(await addNote({ ticketId, actor: admin, type: "INTERNAL_NOTE", body: "  " })).toEqual({ kind: "invalid", reason: "本文が空です" });
    const res = await addNote({ ticketId, actor: admin, type: "EXTERNAL_LOG", body: "電話で一次回答" });
    expect(res).toEqual({ kind: "ok", changed: true });
    const note = await prisma.note.findFirst({ where: { ticketId, type: "EXTERNAL_LOG" } });
    expect(note!.body).toBe("電話で一次回答");
  });

  it("loadTimeline はメール＋メモ＋監査を時系列で返す", async () => {
    const items = await loadTimeline(ticketId);
    expect(items).not.toBeNull();
    expect(items!.length).toBeGreaterThanOrEqual(3);
    expect(items![0].kind).toBe("message"); // 最古＝受信メール
    const kinds = new Set(items!.map((i) => i.kind));
    expect(kinds.has("note")).toBe(true);
    expect(kinds.has("audit")).toBe(true);
  });

  it("存在しないチケットの loadTimeline は null", async () => {
    expect(await loadTimeline("no-such-ticket")).toBeNull();
  });

  it("存在しないチケットの changeStatus は not_found", async () => {
    expect(await changeStatus({ ticketId: "no-such-ticket", actor: admin, status: "DONE" })).toEqual({ kind: "not_found" });
  });
});
