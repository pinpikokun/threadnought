import { prisma } from "@/lib/prisma";
import type { Role } from "@/generated/prisma/client";
import { hashPassword } from "@/lib/auth/password";
import {
  validateNewOperator,
  validatePassword,
  isValidRole,
  validateLabelName,
  normalizeColor,
  validateNewAccount,
  normalizeSignature,
} from "./validation";

// ADMIN設定: オペレータの一覧/作成/更新。呼び出し側(ルート/ページ)で ADMIN 限定を担保する。

export type OperatorRow = {
  id: string;
  username: string;
  displayName: string;
  role: Role;
  isActive: boolean;
  accounts: { id: string; name: string }[];
};

export type AccountRow = { id: string; name: string; casePrefix: string };

type AdminResult<T = unknown> =
  | { kind: "ok"; value: T }
  | { kind: "not_found" }
  | { kind: "invalid"; reason: string };

// 全オペレータを表示名昇順で。割当窓口も添える。
export async function listOperators(): Promise<OperatorRow[]> {
  const ops = await prisma.operator.findMany({
    select: {
      id: true,
      username: true,
      displayName: true,
      role: true,
      isActive: true,
      accounts: { select: { id: true, name: true }, orderBy: { name: "asc" } },
    },
    orderBy: { displayName: "asc" },
  });
  return ops;
}

// 全窓口(担当割当の選択肢)。casePrefix 昇順。
export async function listAccounts(): Promise<AccountRow[]> {
  return prisma.mailAccount.findMany({
    select: { id: true, name: true, casePrefix: true },
    orderBy: { casePrefix: "asc" },
  });
}

export interface CreateOperatorInput {
  username: string;
  displayName: string;
  password: string;
  role: unknown;
  accountIds?: string[];
}

// オペレータ新規作成。入力検証→パスワードハッシュ→窓口 connect。username 重複は invalid。
export async function createOperator(
  input: CreateOperatorInput,
): Promise<AdminResult<{ id: string }>> {
  const v = validateNewOperator(input);
  if (!v.ok) return { kind: "invalid", reason: v.reason };

  const username = input.username.trim();
  const passwordHash = await hashPassword(input.password);
  const accountIds = input.accountIds ?? [];

  try {
    const created = await prisma.operator.create({
      data: {
        username,
        displayName: input.displayName.trim(),
        passwordHash,
        role: input.role as Role,
        accounts: accountIds.length ? { connect: accountIds.map((id) => ({ id })) } : undefined,
      },
      select: { id: true },
    });
    return { kind: "ok", value: { id: created.id } };
  } catch (e) {
    // P2002 = username 一意制約違反。
    if (e && typeof e === "object" && "code" in e && (e as { code?: string }).code === "P2002") {
      return { kind: "invalid", reason: "そのユーザー名は既に使われています" };
    }
    throw e;
  }
}

export interface UpdateOperatorInput {
  role?: unknown;
  isActive?: boolean;
  accountIds?: string[];
}

// オペレータ更新。role/isActive/割当窓口(置換)を部分更新。存在しなければ not_found。
export async function updateOperator(
  id: string,
  input: UpdateOperatorInput,
): Promise<AdminResult> {
  const existing = await prisma.operator.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { kind: "not_found" };

  if (input.role !== undefined && !isValidRole(input.role)) {
    return { kind: "invalid", reason: "ロールが不正です" };
  }

  await prisma.operator.update({
    where: { id },
    data: {
      role: input.role !== undefined ? (input.role as Role) : undefined,
      isActive: input.isActive !== undefined ? input.isActive : undefined,
      accounts: input.accountIds !== undefined ? { set: input.accountIds.map((a) => ({ id: a })) } : undefined,
    },
  });
  return { kind: "ok", value: undefined };
}

// パスワードリセット。最小長を検証してハッシュ更新。存在しなければ not_found。
export async function resetOperatorPassword(
  id: string,
  password: string,
): Promise<AdminResult> {
  const v = validatePassword(password);
  if (!v.ok) return { kind: "invalid", reason: v.reason };
  const existing = await prisma.operator.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { kind: "not_found" };
  const passwordHash = await hashPassword(password);
  await prisma.operator.update({ where: { id }, data: { passwordHash } });
  return { kind: "ok", value: undefined };
}

// ===== ラベル管理 =====

export type LabelRow = { id: string; name: string; color: string };

// 全ラベルを名前昇順で。color は表示用に "" へ正規化。
export async function listLabels(): Promise<LabelRow[]> {
  const labels = await prisma.label.findMany({
    select: { id: true, name: true, color: true },
    orderBy: { name: "asc" },
  });
  return labels.map((l) => ({ id: l.id, name: l.name, color: l.color ?? "" }));
}

export async function createLabel(input: { name: string; color?: unknown }): Promise<AdminResult<{ id: string }>> {
  const v = validateLabelName(input.name ?? "");
  if (!v.ok) return { kind: "invalid", reason: v.reason };
  const created = await prisma.label.create({
    data: { name: input.name.trim(), color: normalizeColor(input.color) },
    select: { id: true },
  });
  return { kind: "ok", value: { id: created.id } };
}

export async function updateLabel(id: string, input: { name?: string; color?: unknown }): Promise<AdminResult> {
  const existing = await prisma.label.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { kind: "not_found" };
  if (input.name !== undefined) {
    const v = validateLabelName(input.name);
    if (!v.ok) return { kind: "invalid", reason: v.reason };
  }
  await prisma.label.update({
    where: { id },
    data: {
      name: input.name !== undefined ? input.name.trim() : undefined,
      color: input.color !== undefined ? normalizeColor(input.color) : undefined,
    },
  });
  return { kind: "ok", value: undefined };
}

// ラベル削除。付与済みチケットとの関連(暗黙M2M)は Prisma が自動で解消する。
export async function deleteLabel(id: string): Promise<AdminResult> {
  const existing = await prisma.label.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { kind: "not_found" };
  await prisma.label.delete({ where: { id } });
  return { kind: "ok", value: undefined };
}

// ===== 窓口(MailAccount)管理 =====
// casePrefix は採番(Counter)キーのため作成後は変更不可。config(IMAP/SMTP認証情報)の
// 編集はこの増分の対象外(暗号化設計が将来課題)。作成時は空 config で登録する。

export type AccountDetailRow = {
  id: string;
  name: string;
  casePrefix: string;
  signature: string;
  adapterType: string;
  ticketCount: number;
  operatorCount: number;
};

export async function listAccountsDetail(): Promise<AccountDetailRow[]> {
  const accounts = await prisma.mailAccount.findMany({
    select: {
      id: true,
      name: true,
      casePrefix: true,
      signature: true,
      adapterType: true,
      _count: { select: { tickets: true, operators: true } },
    },
    orderBy: { casePrefix: "asc" },
  });
  return accounts.map((a) => ({
    id: a.id,
    name: a.name,
    casePrefix: a.casePrefix,
    signature: a.signature ?? "",
    adapterType: a.adapterType,
    ticketCount: a._count.tickets,
    operatorCount: a._count.operators,
  }));
}

export async function createAccount(input: {
  name: string;
  casePrefix: string;
  signature?: unknown;
}): Promise<AdminResult<{ id: string }>> {
  const v = validateNewAccount({ name: input.name ?? "", casePrefix: input.casePrefix ?? "" });
  if (!v.ok) return { kind: "invalid", reason: v.reason };

  const casePrefix = input.casePrefix.trim();
  // casePrefix は採番の一意キー。重複すると連番が衝突するため事前に拒否する。
  const dup = await prisma.mailAccount.findFirst({ where: { casePrefix }, select: { id: true } });
  if (dup) return { kind: "invalid", reason: "その採番接頭辞は既に使われています" };

  const sig = normalizeSignature(input.signature);
  const created = await prisma.mailAccount.create({
    data: {
      name: input.name.trim(),
      casePrefix,
      signature: sig === undefined ? null : sig,
      config: {},
    },
    select: { id: true },
  });
  return { kind: "ok", value: { id: created.id } };
}

// 窓口更新。name/signature のみ(casePrefix は不変)。存在しなければ not_found。
export async function updateAccount(
  id: string,
  input: { name?: string; signature?: unknown },
): Promise<AdminResult> {
  const existing = await prisma.mailAccount.findUnique({ where: { id }, select: { id: true } });
  if (!existing) return { kind: "not_found" };
  if (input.name !== undefined && input.name.trim() === "") {
    return { kind: "invalid", reason: "窓口名を入力してください" };
  }
  await prisma.mailAccount.update({
    where: { id },
    data: {
      name: input.name !== undefined ? input.name.trim() : undefined,
      signature: normalizeSignature(input.signature),
    },
  });
  return { kind: "ok", value: undefined };
}
