import { NextRequest, NextResponse } from "next/server";
import { getCurrentActor } from "@/lib/auth/current";
import { setAccountCredentials, type CredentialsInput } from "@/lib/admin/admin-repo";
import { recordAdminAudit } from "@/lib/admin/admin-audit";

export const dynamic = "force-dynamic";

// 1セクション(imap/smtp)の必須項目を検証して取り出す。無効なら null。
function parseSection(v: unknown): { host: string; port: number; secure: boolean; user: string; pass: string; mailbox?: string } | null {
  if (!v || typeof v !== "object") return null;
  const s = v as Record<string, unknown>;
  if (typeof s.host !== "string" || s.host.trim() === "") return null;
  if (typeof s.user !== "string" || typeof s.pass !== "string") return null;
  return {
    host: s.host.trim(),
    port: typeof s.port === "number" ? s.port : Number(s.port),
    secure: s.secure === true || s.secure === "true",
    user: s.user,
    pass: s.pass,
    ...(typeof s.mailbox === "string" && s.mailbox ? { mailbox: s.mailbox } : {}),
  };
}

// 窓口の認証情報(IMAP/SMTP)を暗号化保存する。ADMIN 限定。
// body: { imap?: {host,port,secure,user,pass,mailbox?}, smtp?: {host,port,secure,user,pass} }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getCurrentActor();
  if (!actor) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (actor.role !== "ADMIN") return NextResponse.json({ ok: false, error: "権限がありません" }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }
  const b = body as { imap?: unknown; smtp?: unknown };

  const input: CredentialsInput = {};
  if (b.imap !== undefined) {
    const imap = parseSection(b.imap);
    if (!imap) return NextResponse.json({ ok: false, error: "imap の host/user/pass が不正です" }, { status: 400 });
    input.imap = imap;
  }
  if (b.smtp !== undefined) {
    const smtp = parseSection(b.smtp);
    if (!smtp) return NextResponse.json({ ok: false, error: "smtp の host/user/pass が不正です" }, { status: 400 });
    input.smtp = { host: smtp.host, port: smtp.port, secure: smtp.secure, user: smtp.user, pass: smtp.pass };
  }

  const res = await setAccountCredentials(id, input);
  if (res.kind === "ok") {
    await recordAdminAudit({ actorId: actor.operatorId, action: "ACCOUNT_UPDATED", targetType: "account", targetId: id, summary: "認証情報" });
    return NextResponse.json({ ok: true });
  }
  if (res.kind === "invalid") return NextResponse.json({ ok: false, error: res.reason }, { status: 400 });
  return NextResponse.json({ ok: false, error: "対象が見つかりません" }, { status: 404 });
}
