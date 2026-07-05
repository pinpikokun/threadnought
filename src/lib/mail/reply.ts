import type { EmailAddr } from "./types";
import type { OutgoingEmail, MailSender } from "./sender";
import { buildQuoteText, type QuoteSource } from "./quote";

export type ReplyOriginal = {
  subject: string;
  messageId: string;
  references: string[];
  from: EmailAddr;
  date: Date;
  text?: string;
};

export type ComposeReplyInput = {
  from: EmailAddr;
  to: EmailAddr[];
  cc?: EmailAddr[];
  bcc?: EmailAddr[];
  bodyText: string;      // オペレータ本文（テンプレ展開済み）
  original: ReplyOriginal;
  caseNumber: string;
  tokenEnabled: boolean;
  signature?: string;
  includeQuote: boolean;
};

export function replySubject(subject: string): string {
  const s = subject.trim();
  return /^re:/i.test(s) ? s : `Re: ${s}`;
}

export function applyToken(subject: string, caseNumber: string, enabled: boolean): string {
  if (!enabled) return subject;
  return subject.includes(caseNumber) ? subject : `${subject} [${caseNumber}]`;
}

export function composeReply(input: ComposeReplyInput): OutgoingEmail {
  const subject = applyToken(replySubject(input.original.subject), input.caseNumber, input.tokenEnabled);
  const parts: string[] = [input.bodyText];
  if (input.signature) parts.push(input.signature);
  if (input.includeQuote) {
    const src: QuoteSource = { from: input.original.from, date: input.original.date, text: input.original.text };
    parts.push(buildQuoteText(src));
  }
  return {
    from: input.from,
    to: input.to,
    cc: input.cc,
    bcc: input.bcc,
    subject,
    text: parts.join("\n\n"),
    inReplyTo: input.original.messageId,
    references: [...input.original.references, input.original.messageId],
  };
}

export type ReplyContext = {
  ticket: {
    id: string;
    caseNumber: string;
    subject: string;
    status: "UNHANDLED" | "IN_PROGRESS" | "DONE";
    assigneeId: string | null;
    tokenEnabled: boolean;
  };
  from: EmailAddr;      // 窓口の送信元アドレス
  signature?: string;
  last: ReplyOriginal;  // 返信対象＝直近の受信メール
};

export type OutboundSave = {
  ticketId: string;
  operatorId: string;
  outgoing: OutgoingEmail;
  sentMessageId: string;
  autoAssign: boolean;   // 未割当なら operatorId を担当に
  toInProgress: boolean; // UNHANDLED なら IN_PROGRESS に
};

export interface ReplyRepository {
  loadReplyContext(ticketId: string): Promise<ReplyContext | null>;
  saveOutbound(input: OutboundSave): Promise<{ messageDbId: string }>;
}

export type SendReplyInput = {
  ticketId: string;
  operatorId: string;
  bodyText: string;         // テンプレ展開済みの最終本文
  to?: EmailAddr[];         // 省略時は元差出人
  cc?: EmailAddr[];
  bcc?: EmailAddr[];
  includeQuote?: boolean;   // 省略時 true
};

export type SendReplyResult =
  | { kind: "sent"; ticketId: string; sentMessageId: string; caseNumber: string }
  | { kind: "not_found" };

export async function sendReply(
  input: SendReplyInput,
  deps: { repo: ReplyRepository; sender: MailSender },
): Promise<SendReplyResult> {
  const ctx = await deps.repo.loadReplyContext(input.ticketId);
  if (!ctx) return { kind: "not_found" };

  const outgoing = composeReply({
    from: ctx.from,
    to: input.to ?? [ctx.last.from],
    cc: input.cc,
    bcc: input.bcc,
    bodyText: input.bodyText,
    original: ctx.last,
    caseNumber: ctx.ticket.caseNumber,
    tokenEnabled: ctx.ticket.tokenEnabled,
    signature: ctx.signature,
    includeQuote: input.includeQuote ?? true,
  });

  const { messageId } = await deps.sender.send(outgoing);

  await deps.repo.saveOutbound({
    ticketId: ctx.ticket.id,
    operatorId: input.operatorId,
    outgoing,
    sentMessageId: messageId,
    autoAssign: ctx.ticket.assigneeId == null,
    toInProgress: ctx.ticket.status === "UNHANDLED",
  });

  return { kind: "sent", ticketId: ctx.ticket.id, sentMessageId: messageId, caseNumber: ctx.ticket.caseNumber };
}
