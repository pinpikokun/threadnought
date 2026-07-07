import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import {
  listOperators,
  listAccounts,
  createOperator,
  updateOperator,
  resetOperatorPassword,
} from "./admin-repo";

// 非重複PREFIX(既存 LKUP/MGCND/NUMT/OP/MS/AUTH/SESS/TLST/SX*/ADMOP と前方一致しない)。
const PREFIX = "ADMOP";
let accountAId = "";
let accountBId = "";

beforeAll(async () => {
  const accA = await prisma.mailAccount.create({ data: { name: `${PREFIX}窓口A`, casePrefix: `${PREFIX}A`, config: {} } });
  const accB = await prisma.mailAccount.create({ data: { name: `${PREFIX}窓口B`, casePrefix: `${PREFIX}B`, config: {} } });
  accountAId = accA.id;
  accountBId = accB.id;
});

afterAll(async () => {
  await prisma.operator.deleteMany({ where: { username: { contains: PREFIX } } });
  await prisma.mailAccount.deleteMany({ where: { casePrefix: { startsWith: PREFIX } } });
  await prisma.$disconnect();
});

describe("createOperator / listOperators", () => {
  it("作成→一覧に現れ、パスワードはハッシュ化され、窓口が connect される", async () => {
    const res = await createOperator({
      username: `${PREFIX}-taro`,
      displayName: `${PREFIX}太郎`,
      password: "password1",
      role: "MEMBER",
      accountIds: [accountAId],
    });
    expect(res.kind).toBe("ok");

    const ops = await listOperators();
    const mine = ops.find((o) => o.username === `${PREFIX}-taro`);
    expect(mine).toBeDefined();
    expect(mine!.role).toBe("MEMBER");
    expect(mine!.isActive).toBe(true);
    expect(mine!.accounts.map((a) => a.id)).toEqual([accountAId]);

    // パスワードは平文で保存されていない(ハッシュで検証できる)。
    const raw = await prisma.operator.findUnique({ where: { id: mine!.id }, select: { passwordHash: true } });
    expect(raw!.passwordHash).not.toBe("password1");
    expect(await verifyPassword("password1", raw!.passwordHash)).toBe(true);
  });

  it("username 重複は invalid", async () => {
    await createOperator({ username: `${PREFIX}-dup`, displayName: "D", password: "password1", role: "MEMBER" });
    const again = await createOperator({ username: `${PREFIX}-dup`, displayName: "D2", password: "password1", role: "MEMBER" });
    expect(again.kind).toBe("invalid");
  });

  it("入力不正(短いパスワード)は invalid で作成されない", async () => {
    const res = await createOperator({ username: `${PREFIX}-bad`, displayName: "B", password: "short", role: "MEMBER" });
    expect(res.kind).toBe("invalid");
    const found = await prisma.operator.findUnique({ where: { username: `${PREFIX}-bad` } });
    expect(found).toBeNull();
  });
});

describe("updateOperator", () => {
  it("role/isActive/割当窓口(置換)を更新する", async () => {
    const created = await createOperator({ username: `${PREFIX}-upd`, displayName: "U", password: "password1", role: "MEMBER", accountIds: [accountAId] });
    const id = (created as { kind: "ok"; value: { id: string } }).value.id;

    const res = await updateOperator(id, { role: "DISPATCHER", isActive: false, accountIds: [accountBId] });
    expect(res.kind).toBe("ok");

    const ops = await listOperators();
    const mine = ops.find((o) => o.id === id)!;
    expect(mine.role).toBe("DISPATCHER");
    expect(mine.isActive).toBe(false);
    expect(mine.accounts.map((a) => a.id)).toEqual([accountBId]);
  });

  it("存在しない id は not_found", async () => {
    const res = await updateOperator("nonexistent-admop-id", { isActive: false });
    expect(res.kind).toBe("not_found");
  });

  it("不正な role は invalid", async () => {
    const created = await createOperator({ username: `${PREFIX}-role`, displayName: "R", password: "password1", role: "MEMBER" });
    const id = (created as { kind: "ok"; value: { id: string } }).value.id;
    const res = await updateOperator(id, { role: "GOD" });
    expect(res.kind).toBe("invalid");
  });
});

describe("resetOperatorPassword", () => {
  it("新パスワードで検証でき、旧パスワードは失効する", async () => {
    const created = await createOperator({ username: `${PREFIX}-pw`, displayName: "P", password: "oldpass12", role: "MEMBER" });
    const id = (created as { kind: "ok"; value: { id: string } }).value.id;

    const res = await resetOperatorPassword(id, "newpass34");
    expect(res.kind).toBe("ok");

    const raw = await prisma.operator.findUnique({ where: { id }, select: { passwordHash: true } });
    expect(await verifyPassword("newpass34", raw!.passwordHash)).toBe(true);
    expect(await verifyPassword("oldpass12", raw!.passwordHash)).toBe(false);
  });

  it("短いパスワードは invalid", async () => {
    const created = await createOperator({ username: `${PREFIX}-pw2`, displayName: "P2", password: "oldpass12", role: "MEMBER" });
    const id = (created as { kind: "ok"; value: { id: string } }).value.id;
    const res = await resetOperatorPassword(id, "short");
    expect(res.kind).toBe("invalid");
  });
});

describe("listAccounts", () => {
  it("作成済みの窓口を含む", async () => {
    const accs = await listAccounts();
    const prefixes = accs.map((a) => a.casePrefix);
    expect(prefixes).toContain(`${PREFIX}A`);
    expect(prefixes).toContain(`${PREFIX}B`);
  });
});
