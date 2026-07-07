import { prisma } from "@/lib/prisma";
import type { TicketStatus } from "@/generated/prisma/client";
import { loadTimeline } from "./ops-repo";
import type { TimelineItem } from "./timeline";
import { storage } from "@/lib/storage";
import { inlineCidImages, type InlineImage } from "@/lib/mail/html-view";

// これを超えるインライン画像は data URI 埋め込みしない(srcDoc の肥大を防ぐ)。cid 参照のまま残る。
const INLINE_IMAGE_MAX_BYTES = 1_048_576; // 1MiB

// bodyHtml に cid: 参照を含むメッセージについて、対応するインライン添付の実体を
// data: URI として本文へ埋め込む。storageKey はクライアントへ渡さず、ここで解決して閉じる。
async function embedInlineImages(timeline: TimelineItem[]): Promise<void> {
  const targets = timeline.filter(
    (it): it is Extract<TimelineItem, { kind: "message" }> =>
      it.kind === "message" && !!it.bodyHtml && it.bodyHtml.includes("cid:"),
  );
  if (targets.length === 0) return;

  const atts = await prisma.attachment.findMany({
    where: {
      messageId: { in: targets.map((t) => t.id) },
      inline: true,
      contentId: { not: null },
      size: { lte: INLINE_IMAGE_MAX_BYTES },
    },
    select: { messageId: true, contentId: true, contentType: true, storageKey: true },
  });
  if (atts.length === 0) return;

  const byMessage = new Map<string, InlineImage[]>();
  for (const a of atts) {
    if (!a.contentId) continue;
    let bytes: Buffer;
    try {
      bytes = await storage.get(a.storageKey);
    } catch {
      continue; // 実体が読めない添付はスキップ(cid のまま=壊れ画像で表示)
    }
    const dataUri = `data:${a.contentType};base64,${bytes.toString("base64")}`;
    const list = byMessage.get(a.messageId) ?? [];
    list.push({ contentId: a.contentId, dataUri });
    byMessage.set(a.messageId, list);
  }

  for (const it of targets) {
    const images = byMessage.get(it.id);
    if (images && it.bodyHtml) it.bodyHtml = inlineCidImages(it.bodyHtml, images);
  }
}

export type TicketHeader = {
  id: string;
  caseNumber: string;
  title: string;
  subject: string;
  status: TicketStatus;
  assigneeId: string | null;
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
      assigneeId: true,
      assignee: { select: { displayName: true } },
      labels: { select: { id: true, name: true, color: true } },
      account: { select: { name: true } },
    },
  });
  if (!ticket) return null;
  const timeline = await loadTimeline(ticketId);
  if (timeline === null) return null;
  await embedInlineImages(timeline);
  return {
    header: {
      id: ticket.id,
      caseNumber: ticket.caseNumber,
      title: ticket.title,
      subject: ticket.subject,
      status: ticket.status,
      assigneeId: ticket.assigneeId,
      assigneeName: ticket.assignee?.displayName ?? null,
      // Label.color はスキーマ上 nullable。表示用に既定色へ寄せる。
      labels: ticket.labels.map((l) => ({ id: l.id, name: l.name, color: l.color ?? "" })),
      accountName: ticket.account.name,
    },
    timeline,
  };
}
