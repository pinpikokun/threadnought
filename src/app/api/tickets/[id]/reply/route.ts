import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendReply } from "@/lib/mail/reply";
import { prismaReplyRepository } from "@/lib/mail/reply-repo";
import { SmtpSender, type SmtpConfig } from "@/lib/mail/adapters/smtp";
import { renderTemplate } from "@/lib/templates/render";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const { operatorId, bodyText, to, cc, bcc, includeQuote, templateId } = body ?? {};
  if (!operatorId || (!bodyText && !templateId)) {
    return NextResponse.json({ ok: false, error: "operatorId と bodyText(またはtemplateId) が必要です" }, { status: 400 });
  }

  // テンプレ選択時は差し込み展開してから本文に結合
  let text: string = bodyText ?? "";
  if (templateId) {
    const [tpl, ticket] = await Promise.all([
      prisma.template.findUnique({ where: { id: templateId }, select: { body: true } }),
      prisma.ticket.findUnique({
        where: { id },
        select: {
          caseNumber: true,
          contact: { select: { name: true } },
          assignee: { select: { displayName: true } },
          messages: { where: { direction: "INBOUND" }, orderBy: { sentAt: "desc" }, take: 1, select: { fromAddr: true } },
        },
      }),
    ]);
    if (!tpl) {
      return NextResponse.json({ ok: false, error: "テンプレートが見つかりません" }, { status: 404 });
    }
    if (ticket) {
      const rendered = renderTemplate(tpl.body, {
        顧客名: ticket.contact?.name ?? ticket.messages[0]?.fromAddr ?? "",
        チケット番号: ticket.caseNumber,
        担当者名: ticket.assignee?.displayName ?? "",
      });
      text = bodyText ? `${bodyText}\n\n${rendered}` : rendered;
    }
  }

  // 窓口の SMTP 設定を取得
  const acc = await prisma.ticket.findUnique({ where: { id }, select: { account: { select: { config: true } } } });
  if (!acc) {
    return NextResponse.json({ ok: false, error: "ticket not found" }, { status: 404 });
  }
  const cfg = (acc.account.config ?? {}) as { smtp?: SmtpConfig };
  if (!cfg.smtp?.host) {
    return NextResponse.json({ ok: false, error: "この窓口に SMTP 設定がありません（config.smtp）" }, { status: 400 });
  }

  if (text.trim() === "") {
    return NextResponse.json({ ok: false, error: "本文が空です" }, { status: 400 });
  }

  const result = await sendReply(
    { ticketId: id, operatorId, bodyText: text, to, cc, bcc, includeQuote },
    { repo: prismaReplyRepository, sender: new SmtpSender(cfg.smtp) },
  );
  if (result.kind === "not_found") {
    return NextResponse.json({ ok: false, error: "ticket not found or has no inbound message" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, result });
}
