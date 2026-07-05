import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ImapReceiver, type ImapConfig } from "@/lib/mail/adapters/imap";
import { ingestNew } from "@/lib/mail/ingest";
import { prismaIngestRepository } from "@/lib/mail/ingest-repo";

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
  for (const acc of accounts) {
    const cfg = acc.config as unknown as ImapConfig;
    if (!cfg?.host) continue; // 未設定アカウントはスキップ
    const receiver = new ImapReceiver(cfg);
    const results = await ingestNew(receiver, { accountId: acc.id, prefix: acc.casePrefix }, prismaIngestRepository);
    for (const r of results) summary[r.kind] = (summary[r.kind] ?? 0) + 1;
  }
  return NextResponse.json({ ok: true, summary });
}
