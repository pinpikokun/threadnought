import { prisma } from "@/lib/prisma";
import type { AdminAuditAction } from "@/generated/prisma/client";

export type AdminAuditTargetType = "operator" | "label" | "account";

export type AdminAuditEntry = {
  actorId: string;
  action: AdminAuditAction;
  targetType: AdminAuditTargetType;
  targetId: string;
  summary?: string | null;
};

// ADMIN設定操作を監査ログに1行記録する。操作(オペレータ/ラベル/窓口の変更)が
// 成功した後に、呼び出し側(APIルート)から actor.operatorId を渡して呼ぶ。
// チケット監査(AuditLog)とは別テーブル。ベストエフォート(操作トランザクションの外)。
export async function recordAdminAudit(entry: AdminAuditEntry): Promise<void> {
  await prisma.adminAuditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      summary: entry.summary ?? null,
    },
  });
}

export type AdminAuditRow = {
  id: string;
  actorName: string;
  action: AdminAuditAction;
  targetType: string;
  targetId: string;
  summary: string | null;
  createdAt: Date;
};

// 監査ログを新しい順に取得する(将来の ADMIN 画面表示用)。
export async function listAdminAudits(limit = 100): Promise<AdminAuditRow[]> {
  const rows = await prisma.adminAuditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      action: true,
      targetType: true,
      targetId: true,
      summary: true,
      createdAt: true,
      actor: { select: { displayName: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    actorName: r.actor.displayName,
    action: r.action,
    targetType: r.targetType,
    targetId: r.targetId,
    summary: r.summary,
    createdAt: r.createdAt,
  }));
}
