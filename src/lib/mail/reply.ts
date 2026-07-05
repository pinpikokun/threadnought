import type { EmailAddr } from "./types";
import type { OutgoingEmail } from "./sender";
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
