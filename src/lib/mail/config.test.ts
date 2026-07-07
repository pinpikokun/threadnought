import { describe, it, expect } from "vitest";
import { resolveImapConfig, resolveSmtpConfig } from "./config";
import { encryptSecret } from "@/lib/crypto/secret";

describe("resolveImapConfig", () => {
  it("平坦なconfigからIMAP設定を解決し、暗号化passを復号する", () => {
    const raw = { host: "imap.example.com", port: 993, secure: true, user: "u", pass: encryptSecret("imappass"), mailbox: "INBOX" };
    const cfg = resolveImapConfig(raw);
    expect(cfg).not.toBeNull();
    expect(cfg!.host).toBe("imap.example.com");
    expect(cfg!.pass).toBe("imappass"); // 復号済み
    expect(cfg!.mailbox).toBe("INBOX");
  });

  it("平文passもそのまま読める(後方互換)", () => {
    const cfg = resolveImapConfig({ host: "h", port: 993, secure: true, user: "u", pass: "plainpass" });
    expect(cfg!.pass).toBe("plainpass");
  });

  it("host無しはnull", () => {
    expect(resolveImapConfig({})).toBeNull();
    expect(resolveImapConfig(null)).toBeNull();
  });
});

describe("resolveSmtpConfig", () => {
  it("config.smtp配下からSMTP設定を解決し、暗号化passを復号する", () => {
    const raw = { smtp: { host: "smtp.example.com", port: 587, secure: false, user: "u", pass: encryptSecret("smtppass") } };
    const cfg = resolveSmtpConfig(raw);
    expect(cfg).not.toBeNull();
    expect(cfg!.host).toBe("smtp.example.com");
    expect(cfg!.pass).toBe("smtppass"); // 復号済み
  });

  it("smtp未設定はnull", () => {
    expect(resolveSmtpConfig({})).toBeNull();
    expect(resolveSmtpConfig({ smtp: {} })).toBeNull();
    expect(resolveSmtpConfig(null)).toBeNull();
  });
});
