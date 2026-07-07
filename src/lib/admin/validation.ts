import type { Role } from "@/generated/prisma/client";

// ADMIN設定のオペレータ操作にまつわる純粋バリデーション。
// DB操作は admin-repo.ts、権限判定(ADMIN限定)は各ルート/ページが担う。

export const ROLES: Role[] = ["ADMIN", "DISPATCHER", "MEMBER"];
export const MIN_PASSWORD_LENGTH = 8;

export type ValidationResult = { ok: true } | { ok: false; reason: string };

export function isValidRole(role: unknown): role is Role {
  return typeof role === "string" && (ROLES as string[]).includes(role);
}

export interface NewOperatorInput {
  username: string;
  displayName: string;
  password: string;
  role: unknown;
}

// 新規オペレータ作成の入力検証。username は空白不可・表示名必須・パスワード最小長・ロール妥当性。
export function validateNewOperator(input: NewOperatorInput): ValidationResult {
  const username = input.username?.trim() ?? "";
  if (username === "") return { ok: false, reason: "ユーザー名を入力してください" };
  if (/\s/.test(username)) return { ok: false, reason: "ユーザー名に空白は使えません" };
  if (username.length > 64) return { ok: false, reason: "ユーザー名が長すぎます" };

  if ((input.displayName?.trim() ?? "") === "") {
    return { ok: false, reason: "表示名を入力してください" };
  }
  if ((input.password ?? "").length < MIN_PASSWORD_LENGTH) {
    return { ok: false, reason: `パスワードは${MIN_PASSWORD_LENGTH}文字以上にしてください` };
  }
  if (!isValidRole(input.role)) {
    return { ok: false, reason: "ロールが不正です" };
  }
  return { ok: true };
}

// パスワードリセットの入力検証(最小長のみ)。
export function validatePassword(password: string): ValidationResult {
  if ((password ?? "").length < MIN_PASSWORD_LENGTH) {
    return { ok: false, reason: `パスワードは${MIN_PASSWORD_LENGTH}文字以上にしてください` };
  }
  return { ok: true };
}

export const MAX_LABEL_NAME_LENGTH = 40;

// ラベル名の検証。空不可・長さ上限のみ(色は任意で緩く扱う)。
export function validateLabelName(name: string): ValidationResult {
  const trimmed = name?.trim() ?? "";
  if (trimmed === "") return { ok: false, reason: "ラベル名を入力してください" };
  if (trimmed.length > MAX_LABEL_NAME_LENGTH) return { ok: false, reason: "ラベル名が長すぎます" };
  return { ok: true };
}

// 色の正規化: 空文字/未指定は null、それ以外はそのまま(UIは <input type=color> でhex供給)。
export function normalizeColor(color: unknown): string | null {
  if (typeof color !== "string") return null;
  const trimmed = color.trim();
  return trimmed === "" ? null : trimmed;
}

export const MAX_CASE_PREFIX_LENGTH = 16;
const CASE_PREFIX_RE = /^[A-Za-z0-9-]+$/;

// 新規窓口の検証。name 必須・casePrefix は英数とハイフンのみ・長さ上限。
// casePrefix は採番(Counter)キーのため、作成後は変更不可の前提。
export function validateNewAccount(input: { name: string; casePrefix: string }): ValidationResult {
  if ((input.name?.trim() ?? "") === "") return { ok: false, reason: "窓口名を入力してください" };
  const prefix = input.casePrefix?.trim() ?? "";
  if (prefix === "") return { ok: false, reason: "採番接頭辞を入力してください" };
  if (prefix.length > MAX_CASE_PREFIX_LENGTH) return { ok: false, reason: "採番接頭辞が長すぎます" };
  if (!CASE_PREFIX_RE.test(prefix)) return { ok: false, reason: "採番接頭辞は英数字とハイフンのみ使えます" };
  return { ok: true };
}

// signature の正規化: 未指定は skip(undefined)、空文字は null、それ以外はそのまま。
export function normalizeSignature(sig: unknown): string | null | undefined {
  if (sig === undefined) return undefined;
  if (typeof sig !== "string") return null;
  return sig === "" ? null : sig;
}
