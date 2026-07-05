import type { EmailAddr } from "./types";

export type OutgoingEmail = {
  from: EmailAddr;
  to: EmailAddr[];
  cc?: EmailAddr[];
  bcc?: EmailAddr[];
  subject: string;
  text: string;
  html?: string;
  inReplyTo?: string;
  references: string[];
};

export type SendResult = { messageId: string };

export interface MailSender {
  send(email: OutgoingEmail): Promise<SendResult>;
}
