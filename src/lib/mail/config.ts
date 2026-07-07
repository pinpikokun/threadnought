import { decryptSecret } from "@/lib/crypto/secret";
import type { ImapConfig } from "./adapters/imap";
import type { SmtpConfig } from "./adapters/smtp";

// MailAccount.config の形は歴史的に非対称:
//   IMAP: config 直下に平坦(host/port/secure/user/pass/mailbox)
//   SMTP: config.smtp 配下に SmtpConfig
// この形は保ったまま、認証情報(pass)だけを読み取り時に復号する。
// 保存が平文でも decryptSecret がそのまま返すため後方互換(移行期)。

// 受信(IMAP)設定を解決する。host が無ければ未設定として null。
export function resolveImapConfig(raw: unknown): ImapConfig | null {
  const c = (raw ?? {}) as Partial<ImapConfig>;
  if (!c.host) return null;
  return {
    host: c.host,
    port: Number(c.port ?? 993),
    secure: c.secure ?? true,
    user: c.user ?? "",
    pass: decryptSecret(c.pass ?? ""),
    mailbox: c.mailbox,
  };
}

// 送信(SMTP)設定を解決する。config.smtp.host が無ければ null。
export function resolveSmtpConfig(raw: unknown): SmtpConfig | null {
  const c = ((raw ?? {}) as { smtp?: Partial<SmtpConfig> }).smtp;
  if (!c?.host) return null;
  return {
    host: c.host,
    port: Number(c.port ?? 587),
    secure: c.secure ?? false,
    user: c.user ?? "",
    pass: decryptSecret(c.pass ?? ""),
  };
}
