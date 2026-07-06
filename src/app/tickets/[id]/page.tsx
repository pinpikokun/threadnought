import { redirect, notFound } from "next/navigation";
import { getCurrentActor } from "@/lib/auth/current";
import { assertTicketAccess } from "@/lib/auth/access";
import { loadTicketDetail } from "@/lib/ops/ticket-detail";
import { t } from "@/lib/i18n/ja";
import { StatusBadge, TimelineView } from "./parts";
import { ReplyForm } from "./reply-form";
import { StatusControl, AddNoteForm } from "./ticket-actions";

export const dynamic = "force-dynamic";

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getCurrentActor();
  if (!actor) redirect("/login");

  // forbidden と not_found は同一の 404 に潰し、存在有無やメタ情報を漏らさない。
  const access = await assertTicketAccess(actor, id);
  if (access !== "ok") notFound();

  const detail = await loadTicketDetail(id);
  if (!detail) notFound();

  const { header, timeline } = detail;

  // 直近の受信(INBOUND)差出人を返信先の初期値にする。
  let defaultTo = "";
  for (let i = timeline.length - 1; i >= 0; i--) {
    const it = timeline[i];
    if (it.kind === "message" && it.direction === "INBOUND") {
      defaultTo = it.fromAddr;
      break;
    }
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: "1rem" }}>
      <a href="/" style={{ fontSize: 13 }}>← 一覧へ戻る</a>
      <header style={{ borderBottom: "1px solid #ddd", paddingBottom: ".75rem", margin: ".5rem 0 1rem" }}>
        <div style={{ fontSize: 12, color: "#888" }}>{header.caseNumber} · {header.accountName}</div>
        <h1 style={{ fontSize: 20, margin: ".25rem 0" }}>{header.title}</h1>
        <div style={{ fontSize: 13, color: "#555", marginBottom: ".5rem" }}>{header.subject}</div>
        <div style={{ display: "flex", gap: ".5rem", alignItems: "center", flexWrap: "wrap" }}>
          <StatusBadge status={header.status} />
          <span style={{ fontSize: 13 }}>{t.assignee}: {header.assigneeName ?? "未割り当て"}</span>
          {header.labels.map((l) => (
            <span key={l.id} style={{ background: l.color || "#9ca3af", color: "#fff", borderRadius: 4, padding: ".1rem .5rem", fontSize: 12 }}>{l.name}</span>
          ))}
        </div>
      </header>
      <div style={{ margin: "0 0 1rem" }}>
        <StatusControl ticketId={header.id} current={header.status} />
      </div>
      <TimelineView items={timeline} />
      <AddNoteForm ticketId={header.id} />
      <ReplyForm ticketId={header.id} defaultTo={defaultTo} />
    </main>
  );
}
