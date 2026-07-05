import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { mergeTickets, splitMessage } from "./ops-repo";
import type { Actor } from "./types";

const PREFIX = "MS";
let accountId = "";
let adminId = "";
let admin: Actor;
const created: string[] = []; // 後始末対象のチケットid

async function makeTicket(caseNumber: string, msgs: { messageId: string; subject: string }[]) {
  const t = await prisma.ticket.create({
    data: {
      caseNumber, token: caseNumber, title: caseNumber, subject: caseNumber, accountId,
      status: "UNHANDLED", messageCount: msgs.length,
      messages: { create: msgs.map((m) => ({
        direction: "INBOUND" as const, messageId: m.messageId, references: [],
        fromAddr: "c@example.com", toAddrs: ["s@example.com"], subject: m.subject,
        bodyText: "本文", sentAt: new Date("2026-06-26T09:00:00Z"),
      })) },
    },
    select: { id: true },
  });
  created.push(t.id);
  return t.id;
}

beforeAll(async () => {
  const account = await prisma.mailAccount.create({ data: { name: "統合分割テスト", casePrefix: PREFIX, config: {} } });
  accountId = account.id;
  const a = await prisma.operator.create({ data: { username: `ms-admin-${PREFIX}`, displayName: "管理者", passwordHash: "x", role: "ADMIN" } });
  adminId = a.id;
  admin = { operatorId: adminId, role: "ADMIN" };
  // 採番カウンタを固定フィクスチャ番号(MS-000001〜000005)より先の値へ退避しておく。
  // 未シードだと nextCaseNumber が MS-000001 から発番し、手動採番のチケットと衝突するため。
  await prisma.counter.create({ data: { prefix: PREFIX, value: 100 } });
});

afterAll(async () => {
  // このテストで採番された分割チケット等も含めて掃除する。
  const all = await prisma.ticket.findMany({ where: { accountId }, select: { id: true } });
  const ids = all.map((t) => t.id);
  await prisma.auditLog.deleteMany({ where: { ticketId: { in: ids } } });
  await prisma.note.deleteMany({ where: { ticketId: { in: ids } } });
  await prisma.message.deleteMany({ where: { ticketId: { in: ids } } });
  await prisma.ticket.deleteMany({ where: { accountId } });
  await prisma.counter.deleteMany({ where: { prefix: PREFIX } });
  await prisma.operator.delete({ where: { id: adminId } });
  await prisma.mailAccount.delete({ where: { id: accountId } });
  await prisma.$disconnect();
});

describe("mergeTickets（統合）", () => {
  it("source の全メールが target へ移り、source はゴミ箱化＋両者にMERGED監査", async () => {
    const src = await makeTicket(`${PREFIX}-000001`, [{ messageId: "<ms-src-1@x>", subject: "元1" }]);
    const tgt = await makeTicket(`${PREFIX}-000002`, [{ messageId: "<ms-tgt-1@x>", subject: "先1" }]);
    const res = await mergeTickets({ sourceId: src, targetId: tgt, actor: admin });
    expect(res).toEqual({ kind: "ok", changed: true });

    const tgtMsgs = await prisma.message.count({ where: { ticketId: tgt } });
    expect(tgtMsgs).toBe(2);
    const targetTicket = await prisma.ticket.findUnique({ where: { id: tgt } });
    expect(targetTicket!.messageCount).toBe(2);
    const sourceTicket = await prisma.ticket.findUnique({ where: { id: src } });
    expect(sourceTicket!.isTrashed).toBe(true);
    expect(sourceTicket!.messageCount).toBe(0);
    const mergedOnTarget = await prisma.auditLog.findFirst({ where: { ticketId: tgt, action: "MERGED" } });
    expect(mergedOnTarget!.toValue).toBe(tgt);
  });

  it("同一チケットの統合は invalid", async () => {
    const t = await makeTicket(`${PREFIX}-000003`, [{ messageId: "<ms-x@x>", subject: "x" }]);
    expect(await mergeTickets({ sourceId: t, targetId: t, actor: admin })).toEqual({ kind: "invalid", reason: "統合元と統合先が同一です" });
  });
});

describe("splitMessage（分割）", () => {
  it("2通のうち1通を新チケットへ切り出す（新採番＋SPLIT監査）", async () => {
    const t = await makeTicket(`${PREFIX}-000004`, [
      { messageId: "<ms-sp-1@x>", subject: "親" },
      { messageId: "<ms-sp-2@x>", subject: "枝分かれ" },
    ]);
    const split = await prisma.message.findUnique({ where: { messageId: "<ms-sp-2@x>" }, select: { id: true } });
    const res = await splitMessage({ ticketId: t, messageId: split!.id, actor: admin });
    expect(res.kind).toBe("ok");
    if (res.kind !== "ok") return;
    created.push(res.newTicketId);

    const newTicket = await prisma.ticket.findUnique({ where: { id: res.newTicketId }, select: { messageCount: true, subject: true } });
    expect(newTicket!.messageCount).toBe(1);
    expect(newTicket!.subject).toBe("枝分かれ");
    const srcTicket = await prisma.ticket.findUnique({ where: { id: t } });
    expect(srcTicket!.messageCount).toBe(1);
    const movedMsg = await prisma.message.findUnique({ where: { messageId: "<ms-sp-2@x>" }, select: { ticketId: true } });
    expect(movedMsg!.ticketId).toBe(res.newTicketId);
    const splitAudit = await prisma.auditLog.findFirst({ where: { ticketId: t, action: "SPLIT" } });
    expect(splitAudit!.toValue).toBe(res.caseNumber);
  });

  it("唯一のメールは分割できない（invalid）", async () => {
    const t = await makeTicket(`${PREFIX}-000005`, [{ messageId: "<ms-only@x>", subject: "唯一" }]);
    const only = await prisma.message.findUnique({ where: { messageId: "<ms-only@x>" }, select: { id: true } });
    expect(await splitMessage({ ticketId: t, messageId: only!.id, actor: admin })).toEqual({ kind: "invalid", reason: "唯一のメールは分割できません" });
  });
});
