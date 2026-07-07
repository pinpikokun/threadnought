import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { updateTicketFields } from "./ops-repo";

// 非重複PREFIX。
const PREFIX = "TKFLD";
let accountId = "";
let ticketId = "";

beforeAll(async () => {
  const acc = await prisma.mailAccount.create({ data: { name: `${PREFIX}窓口`, casePrefix: `${PREFIX}A`, config: {} } });
  accountId = acc.id;
  const ticket = await prisma.ticket.create({
    data: { caseNumber: `${PREFIX}A-000001`, token: `${PREFIX}A-000001`, title: "元の件名", subject: "S", accountId, status: "UNHANDLED", messageCount: 0 },
  });
  ticketId = ticket.id;
});

afterAll(async () => {
  await prisma.ticket.deleteMany({ where: { caseNumber: { startsWith: PREFIX } } });
  await prisma.mailAccount.deleteMany({ where: { casePrefix: { startsWith: PREFIX } } });
  await prisma.$disconnect();
});

describe("updateTicketFields", () => {
  it("title/isPinned/dueDate を更新する", async () => {
    const res = await updateTicketFields({ ticketId, title: "新しい件名", isPinned: true, dueDate: "2026-08-01" });
    expect(res.kind).toBe("ok");
    const t = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { title: true, isPinned: true, dueDate: true } });
    expect(t!.title).toBe("新しい件名");
    expect(t!.isPinned).toBe(true);
    expect(t!.dueDate?.toISOString().slice(0, 10)).toBe("2026-08-01");
  });

  it("dueDate を null でクリアできる", async () => {
    await updateTicketFields({ ticketId, dueDate: "2026-08-01" });
    const res = await updateTicketFields({ ticketId, dueDate: null });
    expect(res.kind).toBe("ok");
    const t = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { dueDate: true } });
    expect(t!.dueDate).toBeNull();
  });

  it("空の件名は invalid で変更されない", async () => {
    await updateTicketFields({ ticketId, title: "確定タイトル" });
    const res = await updateTicketFields({ ticketId, title: "   " });
    expect(res.kind).toBe("invalid");
    const t = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { title: true } });
    expect(t!.title).toBe("確定タイトル");
  });

  it("不正な期日形式は invalid", async () => {
    const res = await updateTicketFields({ ticketId, dueDate: "not-a-date" });
    expect(res.kind).toBe("invalid");
  });

  it("存在しないチケットは not_found", async () => {
    const res = await updateTicketFields({ ticketId: "nonexistent-tkfld", title: "x" });
    expect(res.kind).toBe("not_found");
  });

  it("何も渡さなければ ok(changed:false)", async () => {
    const res = await updateTicketFields({ ticketId });
    expect(res).toEqual({ kind: "ok", changed: false });
  });
});
