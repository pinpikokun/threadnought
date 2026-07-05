import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { createSession, resolveSession, deleteSession } from "./session-repo";

const PREFIX = "SESS";
let opId = "";
let acc1 = "";
let acc2 = "";

beforeAll(async () => {
  const a1 = await prisma.mailAccount.create({ data: { name: `${PREFIX}-acc1`, casePrefix: `${PREFIX}1`, config: {} } });
  const a2 = await prisma.mailAccount.create({ data: { name: `${PREFIX}-acc2`, casePrefix: `${PREFIX}2`, config: {} } });
  acc1 = a1.id;
  acc2 = a2.id;
  const op = await prisma.operator.create({
    data: {
      username: `${PREFIX}-user`,
      displayName: "Sess User",
      passwordHash: "x",
      role: "MEMBER",
      isActive: true,
      accounts: { connect: [{ id: acc1 }, { id: acc2 }] },
    },
  });
  opId = op.id;
});

afterAll(async () => {
  await prisma.session.deleteMany({ where: { operatorId: opId } });
  await prisma.operator.deleteMany({ where: { username: { startsWith: PREFIX } } });
  await prisma.mailAccount.deleteMany({ where: { casePrefix: { startsWith: PREFIX } } });
  await prisma.$disconnect();
});

describe("session repository", () => {
  it("発行→解決で actor（role・accountIds）が取れる", async () => {
    const { token } = await createSession(opId);
    const actor = await resolveSession(token);
    expect(actor).not.toBeNull();
    expect(actor?.operatorId).toBe(opId);
    expect(actor?.role).toBe("MEMBER");
    expect([...(actor?.accountIds ?? [])].sort()).toEqual([acc1, acc2].sort());
    await deleteSession(token);
  });

  it("削除したトークンは解決できない", async () => {
    const { token } = await createSession(opId);
    await deleteSession(token);
    expect(await resolveSession(token)).toBeNull();
  });

  it("期限切れトークンは null（行も消える）", async () => {
    const { token } = await createSession(opId, -1000); // 過去に失効
    expect(await resolveSession(token)).toBeNull();
    const row = await prisma.session.findUnique({ where: { token } });
    expect(row).toBeNull();
  });

  it("存在しないトークンは null", async () => {
    expect(await resolveSession("does-not-exist")).toBeNull();
  });

  it("操作者が無効化されたら解決できない", async () => {
    const { token } = await createSession(opId);
    await prisma.operator.update({ where: { id: opId }, data: { isActive: false } });
    expect(await resolveSession(token)).toBeNull();
    await prisma.operator.update({ where: { id: opId }, data: { isActive: true } }); // 後片付け
  });
});
