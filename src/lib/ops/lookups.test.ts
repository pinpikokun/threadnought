import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { loadAssignableOperators, loadAllLabels } from "./lookups";

const PREFIX = "LKUP";
let accountAId = "";
let accountBId = "";
let ticketAId = "";
let adminId = "";
let memberAId = "";

beforeAll(async () => {
  const accA = await prisma.mailAccount.create({ data: { name: "窓口A", casePrefix: `${PREFIX}A`, config: {} } });
  const accB = await prisma.mailAccount.create({ data: { name: "窓口B", casePrefix: `${PREFIX}B`, config: {} } });
  accountAId = accA.id;
  accountBId = accB.id;

  // ADMIN(窓口所属なし)は全窓口に割り当て可能なはず。
  const admin = await prisma.operator.create({
    data: { username: `admin-${PREFIX}`, displayName: `管理者${PREFIX}`, passwordHash: "x", role: "ADMIN" },
  });
  adminId = admin.id;
  // 窓口A所属のMEMBER。
  const memberA = await prisma.operator.create({
    data: { username: `mA-${PREFIX}`, displayName: `担当A${PREFIX}`, passwordHash: "x", role: "MEMBER", accounts: { connect: { id: accountAId } } },
  });
  memberAId = memberA.id;
  // 窓口B所属のMEMBER(窓口Aには出てこないはず)。
  await prisma.operator.create({
    data: { username: `mB-${PREFIX}`, displayName: `担当B${PREFIX}`, passwordHash: "x", role: "MEMBER", accounts: { connect: { id: accountBId } } },
  });
  // 窓口A所属だが無効なMEMBER(除外されるはず)。
  await prisma.operator.create({
    data: { username: `mAx-${PREFIX}`, displayName: `無効A${PREFIX}`, passwordHash: "x", role: "MEMBER", isActive: false, accounts: { connect: { id: accountAId } } },
  });

  const ticket = await prisma.ticket.create({
    data: { caseNumber: `${PREFIX}A-000001`, token: `${PREFIX}A-000001`, title: "T", subject: "S", accountId: accountAId, status: "UNHANDLED", messageCount: 0 },
  });
  ticketAId = ticket.id;

  await prisma.label.create({ data: { name: `${PREFIX}-緊急`, color: "#f00" } });
  await prisma.label.create({ data: { name: `${PREFIX}-通常`, color: null } });
});

afterAll(async () => {
  await prisma.ticket.deleteMany({ where: { caseNumber: { startsWith: PREFIX } } });
  await prisma.label.deleteMany({ where: { name: { startsWith: `${PREFIX}-` } } });
  await prisma.operator.deleteMany({ where: { username: { contains: PREFIX } } });
  await prisma.mailAccount.deleteMany({ where: { casePrefix: { startsWith: PREFIX } } });
  await prisma.$disconnect();
});

describe("loadAssignableOperators", () => {
  it("当該窓口のMEMBERとADMINを含み、他窓口のみ/無効は除外する", async () => {
    const ops = await loadAssignableOperators(ticketAId);
    expect(ops).not.toBeNull();
    const names = ops!.map((o) => o.displayName);
    expect(names).toContain(`管理者${PREFIX}`);
    expect(names).toContain(`担当A${PREFIX}`);
    expect(names).not.toContain(`担当B${PREFIX}`);
    expect(names).not.toContain(`無効A${PREFIX}`);
  });

  it("displayName 昇順で返す(DBコードポイント順)", async () => {
    const ops = await loadAssignableOperators(ticketAId);
    const names = ops!.map((o) => o.displayName);
    // Postgres の orderBy asc はコードポイント順。JS 既定ソート(UTF-16)と一致する。
    const sorted = [...names].sort();
    expect(names).toEqual(sorted);
  });

  it("存在しないチケットは null", async () => {
    const ops = await loadAssignableOperators("nonexistent-lkup-id");
    expect(ops).toBeNull();
  });
});

describe("loadAllLabels", () => {
  it("name 昇順・color は null を空文字へ正規化", async () => {
    const labels = await loadAllLabels();
    const mine = labels.filter((l) => l.name.startsWith(`${PREFIX}-`));
    expect(mine.map((l) => l.name)).toEqual([`${PREFIX}-緊急`, `${PREFIX}-通常`].sort());
    const normal = mine.find((l) => l.name === `${PREFIX}-通常`);
    expect(normal!.color).toBe("");
  });
});
