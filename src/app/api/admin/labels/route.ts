import { NextRequest, NextResponse } from "next/server";
import { getCurrentActor } from "@/lib/auth/current";
import { createLabel } from "@/lib/admin/admin-repo";
import { recordAdminAudit } from "@/lib/admin/admin-audit";

export const dynamic = "force-dynamic";

// ラベル新規作成。ADMIN 限定。
export async function POST(req: NextRequest) {
  const actor = await getCurrentActor();
  if (!actor) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (actor.role !== "ADMIN") return NextResponse.json({ ok: false, error: "権限がありません" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const { name, color } = (body ?? {}) as { name?: string; color?: unknown };

  const res = await createLabel({ name: name ?? "", color });
  if (res.kind === "ok") {
    await recordAdminAudit({ actorId: actor.operatorId, action: "LABEL_CREATED", targetType: "label", targetId: res.value.id, summary: name ?? null });
    return NextResponse.json({ ok: true, id: res.value.id });
  }
  if (res.kind === "invalid") return NextResponse.json({ ok: false, error: res.reason }, { status: 400 });
  return NextResponse.json({ ok: false, error: "対象が見つかりません" }, { status: 404 });
}
