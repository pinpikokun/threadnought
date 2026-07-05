import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import type { MailReceiver } from "../receiver";
import type { ParsedEmail } from "../types";
import { mapParsedAttachments } from "../attachments";

export type ImapConfig = { host: string; port: number; secure: boolean; user: string; pass: string; mailbox?: string };

export class ImapReceiver implements MailReceiver {
  constructor(private cfg: ImapConfig) {}

  private client() {
    return new ImapFlow({ host: this.cfg.host, port: this.cfg.port, secure: this.cfg.secure, auth: { user: this.cfg.user, pass: this.cfg.pass }, logger: false });
  }

  async fetchNew(): Promise<ParsedEmail[]> {
    const client = this.client();
    await client.connect();
    const out: ParsedEmail[] = [];
    const lock = await client.getMailboxLock(this.cfg.mailbox ?? "INBOX");
    try {
      for await (const msg of client.fetch({ seen: false }, { source: true, uid: true })) {
        if (!msg.source) continue;
        const p = await simpleParser(msg.source);
        out.push({
          uid: String(msg.uid),
          messageId: p.messageId ?? `<${msg.uid}@threadnought.local>`,
          inReplyTo: p.inReplyTo,
          references: ([] as string[]).concat(p.references ?? []),
          from: { address: p.from?.value[0]?.address ?? "", name: p.from?.value[0]?.name },
          to: (p.to && "value" in p.to ? p.to.value : []).map((a) => ({ address: a.address ?? "", name: a.name })),
          subject: p.subject ?? "(件名なし)",
          text: p.text,
          html: typeof p.html === "string" ? p.html : undefined,
          date: p.date ?? new Date(),
          raw: msg.source.toString(),
          attachments: mapParsedAttachments(p.attachments ?? []),
        });
      }
    } finally {
      lock.release();
      await client.logout();
    }
    return out;
  }

  async markProcessed(uids: string[]): Promise<void> {
    if (!uids.length) return;
    const client = this.client();
    await client.connect();
    const lock = await client.getMailboxLock(this.cfg.mailbox ?? "INBOX");
    try {
      await client.messageFlagsAdd({ uid: uids.join(",") }, ["\\Seen"], { uid: true });
    } finally {
      lock.release();
      await client.logout();
    }
  }
}
