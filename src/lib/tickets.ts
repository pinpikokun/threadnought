import { prisma } from "@/lib/prisma";
import type { TicketStatus } from "@prisma/client";

export type TicketListItem = {
  id: string;
  caseNumber: string;
  title: string;
  status: TicketStatus;
  assigneeName: string | null;
  messageCount: number;
  updatedAt: Date;
};

export async function listTickets(): Promise<TicketListItem[]> {
  const rows = await prisma.ticket.findMany({
    where: { isTrashed: false },
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
