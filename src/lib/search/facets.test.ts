import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { getFacetCounts } from "./search";
import type { SearchActor } from "./search";

const PREFIX = "SRCHF";
let accountA = "";
let alice = "";
let labelUrgent = "";
let memberA: SearchActor;

beforeAll(async () => {
  const a = await prisma.mailAccount.create({ data: { name: "件数窓口A", casePrefix: `${PREFIX}A`, config: {} } });
  accountA = a.id;
  const al = await prisma.operator.create({ data: { username: `facet-alice-${PREFIX}`, displayName: "アリス", passwordHash: "x", role: "MEMBER" } });
  alice = al.id;
  const lab = await prisma.label.create({ data: { name: `重要${PREFIX}`, color: "#00f" } });
  labelUrgent = lab.id;

  // UNHANDLED x2(1件はalice担当+ラベル), IN_PROGRESS x1, DONE x0
  await prisma.ticket.create({ data: { caseNumber: `${PREFIX}A-000001`, token: `${PREFIX}A-000001`, title: "F1", subject: "F1", accountId: accountA, status: "UNHANDLED", messageCount: 1, assigneeId: alice, labels: { connect: { id: labelUrgent } } } });
  await prisma.ticket.create({ data: { caseNumber: `${PREFIX}A-000002`, token: `${PREFIX}A-000002`, title: "F2", subject: "F2", accountId: accountA, status: "UNHANDLED", messageCount: 1 } });
  await prisma.ticket.create({ data: { caseNumber: `${PREFIX}A-000003`, token: `${PREFIX}A-000003`, title: "F3", subject: "F3", accountId: accountA, status: "IN_PROGRESS", messageCount: 1 } });

  memberA = { operatorId: alice, role: "MEMBER", accountIds: [accountA] };
});

afterAll(async () => {
  for (const cn of [`${PREFIX}A-000001`, `${PREFIX}A-000002`, `${PREFIX}A-000003`]) {
    const tk = await prisma.ticket.findUnique({ where: { caseNumber: cn }, select: { id: true } });
    if (tk) await prisma.ticket.update({ where: { id: tk.id }, data: { labels: { set: [] } } });
  }
  await prisma.ticket.deleteMany({ where: { caseNumber: { startsWith: PREFIX } } });
  await prisma.label.deleteMany({ where: { name: { startsWith: `重要${PREFIX}` } } });
  await prisma.operator.deleteMany({ where: { username: { startsWith: "facet-" } } });
  await prisma.mailAccount.deleteMany({ where: { casePrefix: { startsWith: PREFIX } } });
  await prisma.$disconnect();
});

describe("getFacetCounts", () => {
  it("窓口スコープ内の総数とステータス別件数", async () => {
    const f = await getFacetCounts(memberA);
    expect(f.total).toBe(3);
    const unhandled = f.status.find((s) => s.value === "UNHANDLED");
    const inprog = f.status.find((s) => s.value === "IN_PROGRESS");
    const done = f.status.find((s) => s.value === "DONE");
    expect(unhandled?.count).toBe(2);
    expect(inprog?.count).toBe(1);
    expect(done?.count).toBe(0);
  });

  it("クイックビュー: 自分の担当と未割り当て", async () => {
    const f = await getFacetCounts(memberA);
    expect(f.quickViews.mine).toBe(1);      // alice担当は1件
    expect(f.quickViews.unassigned).toBe(2); // 未割り当ては2件
  });

  it("ラベル件数と担当件数", async () => {
    const f = await getFacetCounts(memberA);
    const urgent = f.labels.find((l) => l.id === labelUrgent);
    expect(urgent?.count).toBe(1);
    const aliceCount = f.assignees.find((a) => a.operatorId === alice);
    expect(aliceCount?.count).toBe(1);
    expect(aliceCount?.name).toBe("アリス");
  });
});
