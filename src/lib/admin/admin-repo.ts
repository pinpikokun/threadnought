import { prisma } from "@/lib/prisma";
import type { Role } from "@/generated/prisma/client";
import { hashPassword } from "@/lib/auth/password";
import { validateNewOperator, validatePassword, isValidRole } from "./validation";

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
