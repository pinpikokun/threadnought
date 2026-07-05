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
  };
}

export async function listTickets(actor: { role: Role; accountIds: string[] }): Promise<TicketListItem[]> {
  const rows = await prisma.ticket.findMany({
    where: {
      isTrashed: false,
      // ADMINは全窓口。それ以外は自分がアクセスできる窓口のチケットのみ。
      ...(actor.role === "ADMIN" ? {} : { accountId: { in: actor.accountIds } }),
    },
    include: { assignee: true },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(toTicketListItem);
}
