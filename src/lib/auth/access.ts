import { prisma } from "@/lib/prisma";
import type { Role } from "@/generated/prisma/client";

type Scope = { role: Role; accountIds: string[] };

// 窓口アクセス制御の中枢: ADMINは全窓口、それ以外は自分の窓口のみ。
export function canAccessAccount(actor: Scope, accountId: string): boolean {
  return actor.role === "ADMIN" || actor.accountIds.includes(accountId);
}

export type AccessResult = "ok" | "not_found" | "forbidden";

// チケットの所属窓口を見て、この操作者が触れてよいか判定する。
export async function assertTicketAccess(actor: Scope, ticketId: string): Promise<AccessResult> {
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, select: { accountId: true } });
  if (!ticket) return "not_found";
  return canAccessAccount(actor, ticket.accountId) ? "ok" : "forbidden";
}
