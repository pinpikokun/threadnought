import { prepareHtmlBody } from "@/lib/mail/html-view";
import { formatBytes } from "@/lib/format/bytes";
import { t } from "@/lib/i18n/ja";
import type { TimelineItem, AttachmentMeta } from "@/lib/ops/timeline";
import type { TicketStatus } from "@/generated/prisma/client";
import { SplitButton } from "./merge-split";

export function StatusBadge({ status }: { status: TicketStatus }) {
  const bg = status === "DONE" ? "#16a34a" : status === "IN_PROGRESS" ? "#2563eb" : "#9ca3af";
  return (
    <span style={{ background: bg, color: "#fff", borderRadius: 4, padding: ".1rem .5rem", fontSize: 12 }}>
      {t.statusLabel[status]}
    </span>
  );
}

function AttachmentList({ attachments }: { attachments: AttachmentMeta[] }) {
  if (attachments.length === 0) return null;
  return (
    <div style={{ marginTop: ".5rem", borderTop: "1px dashed #ddd", paddingTop: ".5rem" }}>
      <div style={{ fontSize: 12, color: "#666", marginBottom: ".25rem" }}>添付 ({attachments.length})</div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {attachments.map((a) => (
          <li key={a.id} style={{ fontSize: 13, marginBottom: ".2rem" }}>
            <a href={`/api/attachments/${a.id}`}>{a.filename}</a>
            <span style={{ color: "#999", marginLeft: ".5rem" }}>{a.contentType} · {formatBytes(a.size)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MessageBody({ bodyHtml, bodyText }: { bodyHtml: string | null; bodyText: string | null }) {
  if (bodyHtml && bodyHtml.trim() !== "") {
    return (
      <iframe
        sandbox=""
        srcDoc={prepareHtmlBody(bodyHtml)}
        title="メール本文"
        style={{ width: "100%", height: 400, maxHeight: "70vh", border: "1px solid #ddd", background: "#fff" }}
      />
    );
  }
  return <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{bodyText ?? ""}</div>;
}

export function TimelineView({
  items,
  splitTicketId,
  canSplit = false,
}: {
  items: TimelineItem[];
  splitTicketId?: string;
  canSplit?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {items.map((item) => {
        if (item.kind === "message") {
          const inbound = item.direction === "INBOUND";
          return (
            <div key={item.id} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "1rem", background: inbound ? "#fff" : "#f8fafc" }}>
              <div style={{ fontSize: 13, color: "#555", marginBottom: ".5rem", display: "flex", justifyContent: "space-between", alignItems: "center", gap: ".5rem" }}>
                <span><strong>{t.directionLabel[item.direction]}</strong> · {item.fromAddr}</span>
                <span style={{ display: "inline-flex", alignItems: "center", gap: ".5rem" }}>
                  {item.at.toLocaleString("ja-JP")}
                  {splitTicketId && <SplitButton ticketId={splitTicketId} messageId={item.id} canSplit={canSplit} />}
                </span>
              </div>
              <div style={{ fontSize: 13, color: "#333", marginBottom: ".5rem" }}>{item.subject}</div>
              <MessageBody bodyHtml={item.bodyHtml} bodyText={item.bodyText} />
              <AttachmentList attachments={item.attachments} />
            </div>
          );
        }
        if (item.kind === "note") {
          return (
            <div key={item.id} style={{ borderLeft: "3px solid #f59e0b", background: "#fffbeb", padding: ".75rem 1rem", fontSize: 13 }}>
              <div style={{ color: "#92400e", marginBottom: ".25rem" }}>
                {t.noteTypeLabel[item.noteType]} · {item.authorName} · {item.at.toLocaleString("ja-JP")}
              </div>
              <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{item.body}</div>
            </div>
          );
        }
        return (
          <div key={item.id} style={{ fontSize: 12, color: "#888", padding: ".25rem 1rem" }}>
            {item.at.toLocaleString("ja-JP")} · {item.actorName} が {t.auditLabel[item.action]}
            {item.fromValue || item.toValue ? `（${item.fromValue ?? ""} → ${item.toValue ?? ""}）` : ""}
          </div>
        );
      })}
    </div>
  );
}
