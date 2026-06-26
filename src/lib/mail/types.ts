export type EmailAddr = { address: string; name?: string };

export type ParsedEmail = {
  uid: string;            // アダプター内の識別子（markProcessed用）
  messageId: string;      // Message-ID（重複排除キー）
  inReplyTo?: string;
  references: string[];
  from: EmailAddr;
  to: EmailAddr[];
  subject: string;
  text?: string;
  html?: string;
  date: Date;
  raw?: string;
};

export type IngestResult =
  | { kind: "skipped_duplicate"; messageId: string }
  | { kind: "created"; ticketId: string; caseNumber: string }
  | { kind: "appended"; ticketId: string; reopened: boolean };

export type NewInbound = {
  email: ParsedEmail;
  accountId: string;
};

export interface IngestRepository {
  findTicketIdByMessageId(messageId: string): Promise<string | null>;
  ticketIdByMessageIds(messageIds: string[]): Promise<string | null>;
  ticketIdByCaseNumber(caseNumber: string): Promise<string | null>;
  nextCaseNumber(prefix: string): Promise<string>;
  createTicketWithInbound(input: { accountId: string; caseNumber: string; email: ParsedEmail }): Promise<{ ticketId: string }>;
  appendInbound(input: { ticketId: string; email: ParsedEmail }): Promise<{ reopened: boolean }>;
}
