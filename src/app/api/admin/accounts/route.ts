import { NextRequest, NextResponse } from "next/server";
import { getCurrentActor } from "@/lib/auth/current";
import { createAccount } from "@/lib/admin/admin-repo";
import { recordAdminAudit } from "@/lib/admin/admin-audit";

export const dynamic = "force-dynamic";

// 窓口(MailAccount)新規作成。ADMIN 限定。config(認証情報)は空で登録、別途設定する前提。
export async function POST(req: NextRequest) {
  const actor = await getCurrentActor();
  if (!actor) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (actor.role !== "ADMIN") return NextResponse.json({ ok: false, error: "権限がありません" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const { name, casePrefix, signature } = (body ?? {}) as { name?: string; casePrefix?: string; signature?: unknown };

  const res = await createAccount({ name: name ?? "", casePrefix: casePrefix ?? "", signature });
  if (res.kind === "ok") {
    await recordAdminAudit({ actorId: actor.operatorId, action: "ACCOUNT_CREATED", targetType: "account", targetId: res.value.id, summary: casePrefix ?? name ?? null });
    return NextResponse.json({ ok: true, id: res.value.id });
  }
  if (res.kind === "invalid") return NextResponse.json({ ok: false, error: res.reason }, { status: 400 });
  return NextResponse.json({ ok: false, error: "対象が見つかりません" }, { status: 404 });
}
