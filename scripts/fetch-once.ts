// 検証用：全 MailAccount（config.host があるもの）から1回だけ取り込みを実行して結果を表示する
import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { ImapReceiver, type ImapConfig } from "../src/lib/mail/adapters/imap";
import { ingestNew } from "../src/lib/mail/ingest";
import { prismaIngestRepository } from "../src/lib/mail/ingest-repo";

async function main() {
  const accounts = await prisma.mailAccount.findMany();
  for (const acc of accounts) {
    const cfg = acc.config as unknown as ImapConfig;
    if (!cfg?.host) {
      console.log(`skip: ${acc.name}（config.host なし）`);
      continue;
    }
    console.log(`fetching: ${acc.name} (${cfg.host}, user=${cfg.user}) ...`);
    const receiver = new ImapReceiver(cfg);
    const results = await ingestNew(receiver, { accountId: acc.id, prefix: acc.casePrefix }, prismaIngestRepository);
    const summary: Record<string, number> = {};
    for (const r of results) summary[r.kind] = (summary[r.kind] ?? 0) + 1;
    console.log(`  → 取り込み件数=${results.length}`, JSON.stringify(summary));
    for (const r of results) console.log("   ", JSON.stringify(r));
  }
}

main().finally(() => prisma.$disconnect());
