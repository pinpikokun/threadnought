import { prisma } from "@/lib/prisma";
import type { TicketStatus, Role } from "../generated/prisma/client";

export type TicketListItem = {
  id: string;
  caseNumber: string;
  title: string;
  status: TicketStatus;
  assigneeName: string | null;
  messageCount: number;
  updatedAt: Date;
  isPinned: boolean;
  dueDate: Date | null;
};

// listTickets / searchTickets 共通の行→表示アイテム変換（DRY）
export type TicketRowForList = {
  id: string;
  caseNumber: string;
  title: string;
  status: TicketStatus;
  assignee: { displayName: string } | null;
  messageCount: number;
  updatedAt: Date;
  isPinned: boolean;
  dueDate: Date | null;
};

export function toTicketListItem(r: TicketRowForList): TicketListItem {
  return {
    id: r.id,
    caseNumber: r.caseNumber,
    title: r.title,
    status: r.status,
    assigneeName: r.assignee?.displayName ?? null,
    messageCount: r.messageCount,
    updatedAt: r.updatedAt,
    isPinned: r.isPinned,
    dueDate: r.dueDate,
  };
}

// ピン留めを先頭に、その中では更新の新しい順。一覧の既定並び。
export const LIST_ORDER = [{ isPinned: "desc" as const }, { updatedAt: "desc" as const }];

export async function listTickets(actor: { role: Role; accountIds: string[] }): Promise<TicketListItem[]> {
  const rows = await prisma.ticket.findMany({
    where: {
      isTrashed: false,
      // ADMINは全窓口。それ以外は自分がアクセスできる窓口のチケットのみ。
      ...(actor.role === "ADMIN" ? {} : { accountId: { in: actor.accountIds } }),
    },
    include: { assignee: true },
    orderBy: LIST_ORDER,
  });
  return rows.map(toTicketListItem);
}
