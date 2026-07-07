import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ImapReceiver, type ImapConfig } from "@/lib/mail/adapters/imap";
import { ingestNew } from "@/lib/mail/ingest";
import { prismaIngestRepository } from "@/lib/mail/ingest-repo";
import { publishNotification, type NotifyEvent } from "@/lib/notify/bus";

export const dynamic = "force-dynamic";

// このエンドポイントは人間のセッションではなく、常駐ワーカー/Cronなどのマシンから呼ばれる。
// WORKER_TOKEN（env）を x-worker-token ヘッダで照合する。未設定なら常に拒否（誤って無防備に開かない）。
export async function POST(req: NextRequest) {
  const configured = process.env.WORKER_TOKEN;
  const provided = req.headers.get("x-worker-token");
  if (!configured || provided !== configured) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const accounts = await prisma.mailAccount.findMany();
  const summary: Record<string, number> = { created: 0, appended: 0, skipped_duplicate: 0 };
  // 取り込みで動いたチケット(新規/追記/再オープン)を集め、後でまとめて通知イベントを発火する。
  const affected: { ticketId: string; type: NotifyEvent["type"] }[] = [];
  for (const acc of accounts) {
    const cfg = acc.config as unknown as ImapConfig;
    if (!cfg?.host) continue; // 未設定アカウントはスキップ
    const receiver = new ImapReceiver(cfg);
    const results = await ingestNew(receiver, { accountId: acc.id, prefix: acc.casePrefix }, prismaIngestRepository);
    for (const r of results) {
      summary[r.kind] = (summary[r.kind] ?? 0) + 1;
      if (r.kind === "created") affected.push({ ticketId: r.ticketId, type: "ticket_created" });
      else if (r.kind === "appended") affected.push({ ticketId: r.ticketId, type: r.reopened ? "ticket_reopened" : "message_appended" });
    }
  }

  // 通知配信(ベストエフォート)。取り込み本体の成否には影響させない。
  if (affected.length > 0) {
    const metas = await prisma.ticket.findMany({
      where: { id: { in: affected.map((a) => a.ticketId) } },
      select: { id: true, caseNumber: true, title: true, accountId: true },
    });
    const byId = new Map(metas.map((m) => [m.id, m]));
    const at = Date.now();
    for (const a of affected) {
      const m = byId.get(a.ticketId);
      if (m) publishNotification({ type: a.type, accountId: m.accountId, ticketId: m.id, caseNumber: m.caseNumber, title: m.title, at });
    }
  }

  return NextResponse.json({ ok: true, summary });
}
