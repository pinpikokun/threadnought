import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

// 窓口の認証情報(IMAP/SMTPパスワード)を DB 内で暗号化するための小さなユーティリティ。
// 方式: AES-256-GCM(認証付き暗号)。鍵は env CONFIG_ENCRYPTION_KEY(base64の32バイト)。
// 保存形式: "enc:v1:<base64 iv>:<base64 tag>:<base64 ciphertext>"。
// この接頭辞で「暗号化済みか」を判別し、平文(未暗号化)はそのまま扱う(移行期の後方互換)。

const PREFIX = "enc:v1:";

function key(): Buffer {
  const raw = process.env.CONFIG_ENCRYPTION_KEY;
  if (!raw) throw new Error("CONFIG_ENCRYPTION_KEY が未設定です(認証情報の暗号化/復号に必要)");
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error("CONFIG_ENCRYPTION_KEY は base64 の32バイト鍵である必要があります");
  return buf;
}

// 暗号化鍵が利用可能か(env に正しい鍵があるか)。
export function encryptionAvailable(): boolean {
  try {
    key();
    return true;
  } catch {
    return false;
  }
}

export function isEncrypted(value: string): boolean {
  return typeof value === "string" && value.startsWith(PREFIX);
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + [iv, tag, ct].map((b) => b.toString("base64")).join(":");
}

// 暗号化された値なら復号して返す。平文(未暗号化)はそのまま返す(後方互換)。
// 改ざん/鍵不一致は GCM 認証タグ検証で例外になる。
export function decryptSecret(value: string): string {
  if (!isEncrypted(value)) return value;
  const parts = value.slice(PREFIX.length).split(":");
  if (parts.length !== 3) throw new Error("暗号文の形式が不正です");
  const [iv, tag, ct] = parts.map((p) => Buffer.from(p, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}
