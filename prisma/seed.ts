import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // 冪等化：依存順に既存データを削除してから作り直す
  await prisma.message.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.operator.deleteMany();
  await prisma.mailAccount.deleteMany();

  const account = await prisma.mailAccount.create({
    data: { name: "サポート窓口", casePrefix: "SUP", config: {} },
  });
  const op = await prisma.operator.create({
    data: { username: "tanaka", displayName: "田中", passwordHash: "x", role: "ADMIN" },
  });
  for (let i = 1; i <= 2; i++) {
    await prisma.ticket.create({
      data: {
        caseNumber: `SUP-00000${i}`,
        token: `SUP-00000${i}`,
        title: i === 1 ? "お問い合わせの件" : "納期について",
        subject: i === 1 ? "お問い合わせの件" : "納期について",
        accountId: account.id,
        assigneeId: op.id,
        messageCount: 1,
        messages: {
          create: {
            direction: "INBOUND",
            messageId: `<seed-${i}@example.com>`,
            references: [],
            fromAddr: i === 1 ? "yamada@example.com" : "sato@example.com",
            toAddrs: ["support@example.com"],
            subject: i === 1 ? "お問い合わせの件" : "納期について",
            bodyText: "本文サンプル",
            sentAt: new Date("2026-06-26T10:00:00Z"),
          },
        },
      },
    });
  }
}
main().finally(() => prisma.$disconnect());
