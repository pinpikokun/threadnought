import { prisma } from "@/lib/prisma";
import type { TicketStatus } from "@/generated/prisma/client";
import { loadTimeline } from "./ops-repo";
import type { TimelineItem } from "./timeline";

export type TicketHeader = {
  id: string;
  caseNumber: string;
  title: string;
  subject: string;
  status: TicketStatus;
  assigneeName: string | null;
  labels: { id: string; name: string; color: string }[];
  accountName: string;
};

export type TicketDetail = { header: TicketHeader; timeline: TimelineItem[] };

// 詳細ヘッダーとタイムラインをまとめて返す。スコープ判定は呼び出し側(assertTicketAccess)の責務。
export async function loadTicketDetail(ticketId: string): Promise<TicketDetail | null> {
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      id: true, caseNumber: true, title: true, subject: true, status: true,
      assignee: { select: { displayName: true } },
      labels: { select: { id: true, name: true, color: true } },
      account: { select: { name: true } },
    },
  });
  if (!ticket) return null;
  const timeline = await loadTimeline(ticketId);
  if (timeline === null) return null;
  return {
    header: {
      id: ticket.id,
      caseNumber: ticket.caseNumber,
      title: ticket.title,
      subject: ticket.subject,
      status: ticket.status,
      assigneeName: ticket.assignee?.displayName ?? null,
      // Label.color はスキーマ上 nullable。表示用に既定色へ寄せる。
      labels: ticket.labels.map((l) => ({ id: l.id, name: l.name, color: l.color ?? "" })),
      accountName: ticket.account.name,
    },
    timeline,
  };
}
