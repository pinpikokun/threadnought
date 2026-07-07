import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendReply } from "@/lib/mail/reply";
import { prismaReplyRepository } from "@/lib/mail/reply-repo";
import { SmtpSender } from "@/lib/mail/adapters/smtp";
import { resolveSmtpConfig } from "@/lib/mail/config";
import { renderTemplate } from "@/lib/templates/render";
import { getCurrentActor } from "@/lib/auth/current";
import { assertTicketAccess } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

// 注記: 送信は at-least-once セマンティクス。SMTP送信成功後に saveOutbound が失敗すると
// 顧客には届くが記録は残らず、再試行で二重送信し得る。冪等化（アウトボックス方式）は将来課題。
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getCurrentActor();
  if (!actor) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const access = await assertTicketAccess(actor, id);
  if (access === "not_found") return NextResponse.json({ ok: false, error: "ticket not found" }, { status: 404 });
  if (access === "forbidden") return NextResponse.json({ ok: false, error: "権限がありません" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const { bodyText, to, cc, bcc, includeQuote, templateId } = body ?? {};
  if (!bodyText && !templateId) {
    return NextResponse.json({ ok: false, error: "bodyText(またはtemplateId) が必要です" }, { status: 400 });
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
  const smtp = resolveSmtpConfig(acc.account.config); // 認証情報(pass)は復号される
  if (!smtp) {
    return NextResponse.json({ ok: false, error: "この窓口に SMTP 設定がありません（config.smtp）" }, { status: 400 });
  }

  if (text.trim() === "") {
    return NextResponse.json({ ok: false, error: "本文が空です" }, { status: 400 });
  }

  const result = await sendReply(
    { ticketId: id, operatorId: actor.operatorId, bodyText: text, to, cc, bcc, includeQuote },
    { repo: prismaReplyRepository, sender: new SmtpSender(smtp) },
  );
  if (result.kind === "not_found") {
    return NextResponse.json({ ok: false, error: "ticket not found or has no inbound message" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, result });
}
