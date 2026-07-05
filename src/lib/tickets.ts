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
  return rows.map((r) => ({
    id: r.id,
    caseNumber: r.caseNumber,
    title: r.title,
    status: r.status,
    assigneeName: r.assignee?.displayName ?? null,
    messageCount: r.messageCount,
    updatedAt: r.updatedAt,
  }));
}
