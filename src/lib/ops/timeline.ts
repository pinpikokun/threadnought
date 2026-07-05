import type { Direction, NoteType, AuditAction } from "@/generated/prisma/client";

export type AttachmentMeta = {
  id: string;
  filename: string;
  contentType: string;
  size: number;
  inline: boolean;
};

export type TimelineMessageInput = {
  id: string;
  sentAt: Date;
  direction: Direction;
  fromAddr: string;
  subject: string;
  bodyText: string | null;
  bodyHtml: string | null;
  attachments: AttachmentMeta[];
};

export type TimelineNoteInput = {
  id: string;
  occurredAt: Date;
  type: NoteType;
  authorName: string;
  body: string;
};

export type TimelineAuditInput = {
  id: string;
  createdAt: Date;
  action: AuditAction;
  actorName: string;
  fromValue: string | null;
  toValue: string | null;
};

export type TimelineItem =
  | { kind: "message"; id: string; at: Date; direction: Direction; fromAddr: string; subject: string; bodyText: string | null; bodyHtml: string | null; attachments: AttachmentMeta[] }
  | { kind: "note"; id: string; at: Date; noteType: NoteType; authorName: string; body: string }
  | { kind: "audit"; id: string; at: Date; action: AuditAction; actorName: string; fromValue: string | null; toValue: string | null };

// 同時刻の並びを決定的にするための種別ランク。
const RANK: Record<TimelineItem["kind"], number> = { message: 0, note: 1, audit: 2 };

export function buildTimeline(input: {
  messages: TimelineMessageInput[];
  notes: TimelineNoteInput[];
  audits: TimelineAuditInput[];
}): TimelineItem[] {
  const items: TimelineItem[] = [
    ...input.messages.map((m): TimelineItem => ({
      kind: "message", id: m.id, at: m.sentAt, direction: m.direction, fromAddr: m.fromAddr, subject: m.subject, bodyText: m.bodyText, bodyHtml: m.bodyHtml, attachments: m.attachments,
    })),
    ...input.notes.map((n): TimelineItem => ({
      kind: "note", id: n.id, at: n.occurredAt, noteType: n.type, authorName: n.authorName, body: n.body,
    })),
    ...input.audits.map((a): TimelineItem => ({
      kind: "audit", id: a.id, at: a.createdAt, action: a.action, actorName: a.actorName, fromValue: a.fromValue, toValue: a.toValue,
    })),
  ];
  return items.sort((x, y) => {
    const dt = x.at.getTime() - y.at.getTime();
    if (dt !== 0) return dt;
    const dr = RANK[x.kind] - RANK[y.kind];
    if (dr !== 0) return dr;
    return x.id < y.id ? -1 : x.id > y.id ? 1 : 0;
  });
}
