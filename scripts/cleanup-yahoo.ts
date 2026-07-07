// 検証後のお掃除：Yahoo由来チケット(Y-*)・関連レコード・Counter(Y)・Yahoo MailAccount(認証情報) を削除
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const yScope = { ticket: { caseNumber: { startsWith: "Y-" } } };
  const audit = await prisma.auditLog.deleteMany({ where: yScope });
  const note = await prisma.note.deleteMany({ where: yScope });
  const msg = await prisma.message.deleteMany({ where: yScope });
  const ticket = await prisma.ticket.deleteMany({ where: { caseNumber: { startsWith: "Y-" } } });
  const counter = await prisma.counter.deleteMany({ where: { prefix: "Y" } });
  const account = await prisma.mailAccount.deleteMany({ where: { name: "Yahoo検証" } });

  console.log(`削除: audit=${audit.count} note=${note.count} message=${msg.count} ticket=${ticket.count} counter=${counter.count} mailAccount=${account.count}`);
  const remaining = await prisma.ticket.count();
  console.log(`残チケット数: ${remaining}（Phase 1 シードのみ残る想定）`);
}

main().finally(() => prisma.$disconnect());
