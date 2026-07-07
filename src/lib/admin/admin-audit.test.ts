import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { recordAdminAudit, listAdminAudits } from "./admin-audit";

// 非重複PREFIX(既存 ADMOP/TKFLD/SX*/... と前方一致しない)。
const PREFIX = "ADAUD";
let actorId = "";

beforeAll(async () => {
  const op = await prisma.operator.create({
    data: { username: `${PREFIX}-actor`, displayName: `${PREFIX}管理者`, passwordHash: "x", role: "ADMIN" },
  });
  actorId = op.id;
});

afterAll(async () => {
  // AdminAuditLog は Operator を FK(Restrict) 参照するため先に消す。
  await prisma.adminAuditLog.deleteMany({ where: { actorId } });
  await prisma.operator.deleteMany({ where: { username: { startsWith: PREFIX } } });
  await prisma.$disconnect();
});

describe("recordAdminAudit", () => {
  it("監査を1行書き込む(action/target/summary/actor)", async () => {
    await recordAdminAudit({ actorId, action: "OPERATOR_CREATED", targetType: "operator", targetId: `${PREFIX}-op-1`, summary: "taro" });
    const row = await prisma.adminAuditLog.findFirst({ where: { actorId, targetId: `${PREFIX}-op-1` } });
    expect(row).not.toBeNull();
    expect(row!.action).toBe("OPERATOR_CREATED");
    expect(row!.targetType).toBe("operator");
    expect(row!.summary).toBe("taro");
    expect(row!.actorId).toBe(actorId);
  });

  it("summary 省略時は null", async () => {
    await recordAdminAudit({ actorId, action: "LABEL_DELETED", targetType: "label", targetId: `${PREFIX}-lbl-1` });
    const row = await prisma.adminAuditLog.findFirst({ where: { actorId, targetId: `${PREFIX}-lbl-1` } });
    expect(row!.summary).toBeNull();
  });
});

describe("listAdminAudits", () => {
  it("新しい順に並び、actor 表示名を含む", async () => {
    // createdAt を明示して順序を決定的にする。
    await prisma.adminAuditLog.create({ data: { actorId, action: "ACCOUNT_CREATED", targetType: "account", targetId: `${PREFIX}-acc-old`, createdAt: new Date("2026-01-01T00:00:00Z") } });
    await prisma.adminAuditLog.create({ data: { actorId, action: "ACCOUNT_UPDATED", targetType: "account", targetId: `${PREFIX}-acc-new`, createdAt: new Date("2026-02-01T00:00:00Z") } });

    const all = await listAdminAudits(1000);
    const mine = all.filter((r) => r.targetId === `${PREFIX}-acc-old` || r.targetId === `${PREFIX}-acc-new`);
    expect(mine.map((r) => r.targetId)).toEqual([`${PREFIX}-acc-new`, `${PREFIX}-acc-old`]);
    expect(mine[0].actorName).toBe(`${PREFIX}管理者`);
  });
});
