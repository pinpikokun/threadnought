import type { MailReceiver } from "./receiver";
import type { ParsedEmail, IngestRepository } from "./types";
import type { OutgoingEmail, SendResult, MailSender } from "./sender";
import type { ReplyRepository, ReplyContext, OutboundSave } from "./reply";

export class FakeMailReceiver implements MailReceiver {
  processed: string[] = [];
  constructor(private emails: ParsedEmail[]) {}
  async fetchNew() { return this.emails; }
  async markProcessed(uids: string[]) { this.processed.push(...uids); }
}

export function makeEmail(p: Partial<ParsedEmail> & { messageId: string }): ParsedEmail {
  return {
    uid: p.uid ?? p.messageId,
    references: p.references ?? [],
    from: p.from ?? { address: "c@example.com" },
    to: p.to ?? [{ address: "support@example.com" }],
    subject: p.subject ?? "件名",
    date: p.date ?? new Date("2026-06-26T10:00:00Z"),
    ...p,
  };
}

export class FakeIngestRepository implements IngestRepository {
  tickets: { id: string; caseNumber: string; status: "UNHANDLED" | "IN_PROGRESS" | "DONE"; messageIds: string[] }[] = [];
  seq = 0;
  constructor(seed?: typeof FakeIngestRepository.prototype.tickets) { if (seed) this.tickets = seed; }
  async findTicketIdByMessageId(id: string) { return this.tickets.find(t => t.messageIds.includes(id))?.id ?? null; }
  async ticketIdByMessageIds(ids: string[]) { return this.tickets.find(t => t.messageIds.some(m => ids.includes(m)))?.id ?? null; }
  async ticketIdByCaseNumber(cn: string) { return this.tickets.find(t => t.caseNumber === cn)?.id ?? null; }
  async nextCaseNumber(prefix: string) { this.seq++; return `${prefix}-${String(this.seq).padStart(6, "0")}`; }
  async createTicketWithInbound(input: { accountId: string; caseNumber: string; email: { messageId: string } }) {
    const id = `T${this.tickets.length + 1}`;
    this.tickets.push({ id, caseNumber: input.caseNumber, status: "UNHANDLED", messageIds: [input.email.messageId] });
    return { ticketId: id };
  }
  async appendInbound(input: { ticketId: string; email: { messageId: string } }) {
    const t = this.tickets.find(x => x.id === input.ticketId)!;
    t.messageIds.push(input.email.messageId);
    const reopened = t.status === "DONE";
    if (reopened) t.status = "IN_PROGRESS";
    return { reopened };
  }
}

export class FakeMailSender implements MailSender {
  sent: OutgoingEmail[] = [];
  seq = 0;
  async send(email: OutgoingEmail): Promise<SendResult> {
    this.sent.push(email);
    this.seq++;
    return { messageId: `<out-${this.seq}@threadnought.local>` };
  }
}

export class FakeReplyRepository implements ReplyRepository {
  saved: OutboundSave[] = [];
  constructor(private ctx: ReplyContext | null) {}
  async loadReplyContext(_ticketId: string): Promise<ReplyContext | null> {
    return this.ctx;
  }
  async saveOutbound(input: OutboundSave): Promise<{ messageDbId: string }> {
    this.saved.push(input);
    return { messageDbId: `M${this.saved.length}` };
  }
}
