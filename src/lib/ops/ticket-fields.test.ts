import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { updateTicketFields } from "./ops-repo";

// 非重複PREFIX。
const PREFIX = "TKFLD";
let accountId = "";
let ticketId = "";
let auditTicketId = "";
let actorId = "";

beforeAll(async () => {
  const acc = await prisma.mailAccount.create({ data: { name: `${PREFIX}窓口`, casePrefix: `${PREFIX}A`, config: {} } });
  accountId = acc.id;
  const op = await prisma.operator.create({
    data: { username: `${PREFIX}-actor`, displayName: `${PREFIX}操作者`, passwordHash: "x", role: "ADMIN" },
  });
  actorId = op.id;
  const ticket = await prisma.ticket.create({
    data: { caseNumber: `${PREFIX}A-000001`, token: `${PREFIX}A-000001`, title: "元の件名", subject: "S", accountId, status: "UNHANDLED", messageCount: 0 },
  });
  ticketId = ticket.id;
  const at = await prisma.ticket.create({
    data: { caseNumber: `${PREFIX}A-000002`, token: `${PREFIX}A-000002`, title: "監査用", subject: "S", accountId, status: "UNHANDLED", messageCount: 0 },
  });
  auditTicketId = at.id;
});

afterAll(async () => {
  // AuditLog は Ticket/Operator を FK(Restrict) 参照するため先に消す。
  await prisma.auditLog.deleteMany({ where: { ticket: { caseNumber: { startsWith: PREFIX } } } });
  await prisma.ticket.deleteMany({ where: { caseNumber: { startsWith: PREFIX } } });
  await prisma.operator.deleteMany({ where: { username: { startsWith: PREFIX } } });
  await prisma.mailAccount.deleteMany({ where: { casePrefix: { startsWith: PREFIX } } });
  await prisma.$disconnect();
});

describe("updateTicketFields", () => {
  it("title/isPinned/dueDate を更新する", async () => {
    const res = await updateTicketFields({ ticketId, actorId, title: "新しい件名", isPinned: true, dueDate: "2026-08-01" });
    expect(res.kind).toBe("ok");
    const t = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { title: true, isPinned: true, dueDate: true } });
    expect(t!.title).toBe("新しい件名");
    expect(t!.isPinned).toBe(true);
    expect(t!.dueDate?.toISOString().slice(0, 10)).toBe("2026-08-01");
  });

  it("dueDate を null でクリアできる", async () => {
    await updateTicketFields({ ticketId, actorId, dueDate: "2026-08-01" });
    const res = await updateTicketFields({ ticketId, actorId, dueDate: null });
    expect(res.kind).toBe("ok");
    const t = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { dueDate: true } });
    expect(t!.dueDate).toBeNull();
  });

  it("空の件名は invalid で変更されない", async () => {
    await updateTicketFields({ ticketId, actorId, title: "確定タイトル" });
    const res = await updateTicketFields({ ticketId, actorId, title: "   " });
    expect(res.kind).toBe("invalid");
    const t = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { title: true } });
    expect(t!.title).toBe("確定タイトル");
  });

  it("不正な期日形式は invalid", async () => {
    const res = await updateTicketFields({ ticketId, actorId, dueDate: "not-a-date" });
    expect(res.kind).toBe("invalid");
  });

  it("存在しないチケットは not_found", async () => {
    const res = await updateTicketFields({ ticketId: "nonexistent-tkfld", actorId, title: "x" });
    expect(res.kind).toBe("not_found");
  });

  it("何も渡さなければ ok(changed:false)", async () => {
    const res = await updateTicketFields({ ticketId, actorId });
    expect(res).toEqual({ kind: "ok", changed: false });
  });
});

describe("updateTicketFields 監査記録", () => {
  it("件名変更で TITLE_CHANGED を from/to 付きで記録する", async () => {
    await updateTicketFields({ ticketId: auditTicketId, actorId, title: "監査後の件名" });
    const audit = await prisma.auditLog.findFirst({
      where: { ticketId: auditTicketId, action: "TITLE_CHANGED" },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).not.toBeNull();
    expect(audit!.actorId).toBe(actorId);
    expect(audit!.fromValue).toBe("監査用");
    expect(audit!.toValue).toBe("監査後の件名");
  });

  it("ピン留めで PINNED、解除で UNPINNED を記録する", async () => {
    await updateTicketFields({ ticketId: auditTicketId, actorId, isPinned: true });
    const pinned = await prisma.auditLog.findFirst({ where: { ticketId: auditTicketId, action: "PINNED" } });
    expect(pinned).not.toBeNull();

    await updateTicketFields({ ticketId: auditTicketId, actorId, isPinned: false });
    const unpinned = await prisma.auditLog.findFirst({ where: { ticketId: auditTicketId, action: "UNPINNED" } });
    expect(unpinned).not.toBeNull();
  });

  it("期日設定で DUE_DATE_CHANGED を toValue 付きで記録する", async () => {
    await updateTicketFields({ ticketId: auditTicketId, actorId, dueDate: "2026-09-01" });
    const audit = await prisma.auditLog.findFirst({
      where: { ticketId: auditTicketId, action: "DUE_DATE_CHANGED" },
      orderBy: { createdAt: "desc" },
    });
    expect(audit).not.toBeNull();
    expect(audit!.toValue).toBe("2026-09-01");
  });

  it("値が変わらなければ監査を書かない", async () => {
    const cur = await prisma.ticket.findUnique({ where: { id: auditTicketId }, select: { title: true, isPinned: true } });
    const before = await prisma.auditLog.count({ where: { ticketId: auditTicketId } });
    const res = await updateTicketFields({ ticketId: auditTicketId, actorId, title: cur!.title, isPinned: cur!.isPinned });
    expect(res).toEqual({ kind: "ok", changed: false });
    const after = await prisma.auditLog.count({ where: { ticketId: auditTicketId } });
    expect(after).toBe(before);
  });
});
