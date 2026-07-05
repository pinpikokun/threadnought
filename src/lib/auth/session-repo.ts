import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/generated/prisma/client";

export type SessionActor = { operatorId: string; role: Role; accountIds: string[] };

export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7日

export async function createSession(
  operatorId: string,
  ttlMs: number = SESSION_TTL_MS,
): Promise<{ token: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + ttlMs);
  await prisma.session.create({ data: { token, operatorId, expiresAt } });
  return { token, expiresAt };
}

export async function resolveSession(token: string): Promise<SessionActor | null> {
  const session = await prisma.session.findUnique({
    where: { token },
    include: { operator: { include: { accounts: { select: { id: true } } } } },
  });
  if (!session) return null;

  // 期限切れ・操作者無効化はセッションを失効させる（掃除して null）。
  const expired = session.expiresAt.getTime() <= Date.now();
  if (expired || !session.operator.isActive) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  return {
    operatorId: session.operator.id,
    role: session.operator.role,
    accountIds: session.operator.accounts.map((a) => a.id),
  };
}

export async function deleteSession(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { token } });
}
