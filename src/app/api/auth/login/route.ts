import { NextRequest, NextResponse } from "next/server";
import { InternalAuthProvider } from "@/lib/auth/adapters/internal";
import { createSession } from "@/lib/auth/session-repo";
import { setSessionCookie } from "@/lib/auth/cookies";

export const dynamic = "force-dynamic";

const provider = new InternalAuthProvider();

// 注記: ブルートフォース対策のレート制限は将来課題(小規模内部運用のため v1 では未実装)。
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const { username, password } = (body ?? {}) as { username?: string; password?: string };
  if (!username || !password) {
    return NextResponse.json({ ok: false, error: "username と password が必要です" }, { status: 400 });
  }

  const result = await provider.verifyCredentials(username, password);
  if (result.kind === "inactive") {
    return NextResponse.json({ ok: false, error: "このアカウントは無効化されています" }, { status: 403 });
  }
  if (result.kind !== "ok") {
    return NextResponse.json({ ok: false, error: "ユーザー名またはパスワードが違います" }, { status: 401 });
  }

  const { token, expiresAt } = await createSession(result.operatorId);
  await setSessionCookie(token, expiresAt);
  return NextResponse.json({ ok: true });
}
