import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ImapReceiver, type ImapConfig } from "@/lib/mail/adapters/imap";
import { ingestNew } from "@/lib/mail/ingest";
import { prismaIngestRepository } from "@/lib/mail/ingest-repo";

export const dynamic = "force-dynamic";

export async function POST() {
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
