// 検証用：取り込んだチケットの総数と、Yahoo由来チケットのサンプルを表示
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const total = await prisma.ticket.count();
  const yahoo = await prisma.ticket.findMany({
    where: { caseNumber: { startsWith: "Y-" } },
    orderBy: { createdAt: "desc" },
    take: 8,
    include: { messages: { take: 1, select: { fromAddr: true } } },
  });
  console.log(`総チケット数: ${total}`);
  console.log("--- Yahoo由来チケット（最新8件）---");
  for (const t of yahoo) {
    const subj = t.title.length > 44 ? t.title.slice(0, 44) + "…" : t.title;
    console.log(`${t.caseNumber} | from=${t.messages[0]?.fromAddr ?? "?"} | ${subj}`);
  }
}

main().finally(() => prisma.$disconnect());
