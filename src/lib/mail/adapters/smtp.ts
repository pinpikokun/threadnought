import nodemailer from "nodemailer";
import type { MailSender, OutgoingEmail, SendResult } from "../sender";
import type { EmailAddr } from "../types";

export type SmtpConfig = { host: string; port: number; secure: boolean; user: string; pass: string };

const fmt = (a: EmailAddr) => (a.name ? `"${a.name}" <${a.address}>` : a.address);

// OutgoingEmail を nodemailer の sendMail 引数へ変換（純粋・テスト可能）
export function toNodemailerMessage(email: OutgoingEmail) {
  return {
    from: fmt(email.from),
    to: email.to.map(fmt),
    cc: email.cc?.map(fmt),
    bcc: email.bcc?.map(fmt),
    subject: email.subject,
    text: email.text,
    html: email.html,
    inReplyTo: email.inReplyTo,
    references: email.references.join(" "),
  };
}

export class SmtpSender implements MailSender {
  constructor(private cfg: SmtpConfig) {}

  async send(email: OutgoingEmail): Promise<SendResult> {
    const transport = nodemailer.createTransport({
      host: this.cfg.host,
      port: this.cfg.port,
      secure: this.cfg.secure,
      auth: { user: this.cfg.user, pass: this.cfg.pass },
    });
    const info = await transport.sendMail(toNodemailerMessage(email));
    return { messageId: info.messageId };
  }
}
