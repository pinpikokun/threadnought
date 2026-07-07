import "dotenv/config";
import nodemailer from "nodemailer";
import { prisma } from "../src/lib/prisma";
import { prismaReplyRepository } from "../src/lib/mail/reply-repo";
import { composeReply } from "../src/lib/mail/reply";
import { toNodemailerMessage } from "../src/lib/mail/adapters/smtp";

async function main() {
  const ticket = await prisma.ticket.findFirst({ where: { caseNumber: { startsWith: "SUP-" } }, select: { id: true } });
  if (!ticket) throw new Error("シードチケット(SUP-*)が見つかりません。npx prisma db seed を先に実行してください。");

  const ctx = await prismaReplyRepository.loadReplyContext(ticket.id);
  if (!ctx) throw new Error("返信コンテキストを取得できません（INBOUNDメッセージが無い可能性）。");

  const outgoing = composeReply({
    from: ctx.from,
    to: [ctx.last.from],
    bodyText: "お問い合わせありがとうございます。確認して折り返します。",
    original: ctx.last,
    caseNumber: ctx.ticket.caseNumber,
    tokenEnabled: ctx.ticket.tokenEnabled,
    signature: ctx.signature,
    includeQuote: true,
  });

  const transport = nodemailer.createTransport({ jsonTransport: true });
  const info = await transport.sendMail(toNodemailerMessage(outgoing));
  console.log("=== 返信ドライラン（実送信なし・DB変更なし）===");
  console.log(info.message);
}

main().finally(() => prisma.$disconnect());
