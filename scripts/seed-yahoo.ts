// 検証用：Yahoo! JAPAN メールの MailAccount を作成/更新する（接続情報は環境変数から受け取り、ファイルには秘密を書かない）
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const user = process.env.YIMAP_USER;
  const pass = process.env.YIMAP_PASS;
  if (!user || !pass) throw new Error("YIMAP_USER / YIMAP_PASS が未設定です");

  const config = {
    host: process.env.YIMAP_HOST ?? "imap.mail.yahoo.co.jp",
    port: Number(process.env.YIMAP_PORT ?? 993),
    secure: (process.env.YIMAP_SECURE ?? "true") === "true",
    user,
    pass,
    mailbox: process.env.YIMAP_MAILBOX ?? "INBOX",
  };

  const existing = await prisma.mailAccount.findFirst({ where: { name: "Yahoo検証" } });
  const acc = existing
    ? await prisma.mailAccount.update({ where: { id: existing.id }, data: { config, casePrefix: "Y" } })
    : await prisma.mailAccount.create({ data: { name: "Yahoo検証", casePrefix: "Y", config } });

  console.log(`MailAccount ready: id=${acc.id} name=${acc.name} prefix=${acc.casePrefix} host=${config.host} user=${config.user}`);
}

main().finally(() => prisma.$disconnect());
