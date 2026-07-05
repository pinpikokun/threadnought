import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "./password";
import { InternalAuthProvider } from "./adapters/internal";

const PREFIX = "AUTH";
const activeUser = `${PREFIX}-active`;
const inactiveUser = `${PREFIX}-inactive`;
const PW = "correct-horse";

beforeAll(async () => {
  await prisma.operator.create({
    data: { username: activeUser, displayName: "Active", passwordHash: await hashPassword(PW), role: "MEMBER", isActive: true },
  });
  await prisma.operator.create({
    data: { username: inactiveUser, displayName: "Inactive", passwordHash: await hashPassword(PW), role: "MEMBER", isActive: false },
  });
});

afterAll(async () => {
  await prisma.operator.deleteMany({ where: { username: { startsWith: PREFIX } } });
  await prisma.$disconnect();
});

describe("InternalAuthProvider", () => {
  const provider = new InternalAuthProvider();

  it("正しい資格情報で ok と operatorId を返す", async () => {
    const res = await provider.verifyCredentials(activeUser, PW);
    expect(res.kind).toBe("ok");
    if (res.kind === "ok") expect(typeof res.operatorId).toBe("string");
  });

  it("パスワードが違えば invalid_credentials", async () => {
    const res = await provider.verifyCredentials(activeUser, "wrong");
    expect(res.kind).toBe("invalid_credentials");
  });

  it("存在しないユーザーは invalid_credentials", async () => {
    const res = await provider.verifyCredentials(`${PREFIX}-nobody`, PW);
    expect(res.kind).toBe("invalid_credentials");
  });

  it("無効化ユーザーは inactive", async () => {
    const res = await provider.verifyCredentials(inactiveUser, PW);
    expect(res.kind).toBe("inactive");
  });
});
