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

type AttachmentMeta = { filename: string; contentType: string; storageKey: string; size: number; inline: boolean };

// 添付の所有チェーン(attachment→message→ticket→accountId)を辿って可視性を判定する。
// ok のときだけ添付メタを返す（forbidden/not_found では実体情報を漏らさない）。
export async function assertAttachmentAccess(
  actor: Scope,
  attachmentId: string,
): Promise<{ result: AccessResult; attachment: AttachmentMeta | null }> {
  const att = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    select: {
      filename: true, contentType: true, storageKey: true, size: true, inline: true,
      message: { select: { ticket: { select: { accountId: true } } } },
    },
  });
  if (!att) return { result: "not_found", attachment: null };
  if (!canAccessAccount(actor, att.message.ticket.accountId)) return { result: "forbidden", attachment: null };
  const { filename, contentType, storageKey, size, inline } = att;
  return { result: "ok", attachment: { filename, contentType, storageKey, size, inline } };
}
