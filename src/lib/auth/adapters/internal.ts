import { prisma } from "@/lib/prisma";
import { verifyPassword } from "../password";
import type { AuthProvider, AuthResult } from "../provider";

// v1標準アダプター: 内部アカウント（username + password）。
// 識別はログインID(username)。代表メールを複数人で対応する運用のため email は必須にしない。
export class InternalAuthProvider implements AuthProvider {
  async verifyCredentials(username: string, password: string): Promise<AuthResult> {
    const operator = await prisma.operator.findUnique({
      where: { username },
      select: { id: true, passwordHash: true, isActive: true },
    });
    if (!operator) return { kind: "invalid_credentials" };
    const ok = await verifyPassword(password, operator.passwordHash);
    if (!ok) return { kind: "invalid_credentials" };
    if (!operator.isActive) return { kind: "inactive" };
    return { kind: "ok", operatorId: operator.id };
  }
}
