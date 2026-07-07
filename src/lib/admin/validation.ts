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
