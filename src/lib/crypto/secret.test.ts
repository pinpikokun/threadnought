import { describe, it, expect } from "vitest";
import { encryptSecret, decryptSecret, isEncrypted, encryptionAvailable } from "./secret";

// CONFIG_ENCRYPTION_KEY は .env(dotenv/config)から供給される前提。
describe("secret 暗号ユーティリティ", () => {
  it("鍵が利用可能", () => {
    expect(encryptionAvailable()).toBe(true);
  });

  it("暗号化→復号で元に戻る(ラウンドトリップ)", () => {
    const plain = "s3cr3t-パスワード!@#";
    const enc = encryptSecret(plain);
    expect(enc).not.toBe(plain);
    expect(isEncrypted(enc)).toBe(true);
    expect(decryptSecret(enc)).toBe(plain);
  });

  it("毎回異なる暗号文になる(IVがランダム)が同じ平文に復号される", () => {
    const a = encryptSecret("same");
    const b = encryptSecret("same");
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe("same");
    expect(decryptSecret(b)).toBe("same");
  });

  it("平文(未暗号化)は decryptSecret でそのまま返る(後方互換)", () => {
    expect(isEncrypted("plaintextpass")).toBe(false);
    expect(decryptSecret("plaintextpass")).toBe("plaintextpass");
  });

  it("改ざんされた暗号文は復号で例外(GCM認証)", () => {
    const enc = encryptSecret("tamper-me");
    // 末尾(ciphertext)を1文字書き換える。
    const broken = enc.slice(0, -1) + (enc.endsWith("A") ? "B" : "A");
    expect(() => decryptSecret(broken)).toThrow();
  });

  it("空文字も往復できる", () => {
    const enc = encryptSecret("");
    expect(decryptSecret(enc)).toBe("");
  });
});
