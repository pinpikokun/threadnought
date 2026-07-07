import { NextRequest, NextResponse } from "next/server";
import { getCurrentActor, type AppActor } from "@/lib/auth/current";
import { updateLabel, deleteLabel } from "@/lib/admin/admin-repo";
import { recordAdminAudit } from "@/lib/admin/admin-audit";

export const dynamic = "force-dynamic";

async function requireAdmin(): Promise<{ ok: false; res: NextResponse } | { ok: true; actor: AppActor }> {
  const actor = await getCurrentActor();
  if (!actor) return { ok: false, res: NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 }) };
  if (actor.role !== "ADMIN") return { ok: false, res: NextResponse.json({ ok: false, error: "権限がありません" }, { status: 403 }) };
  return { ok: true, actor };
}

function toResponse(res: { kind: "ok"; value?: unknown } | { kind: "not_found" } | { kind: "invalid"; reason: string }) {
  if (res.kind === "ok") return NextResponse.json({ ok: true });
  if (res.kind === "invalid") return NextResponse.json({ ok: false, error: res.reason }, { status: 400 });
  return NextResponse.json({ ok: false, error: "対象が見つかりません" }, { status: 404 });
}

// ラベル更新(改名・改色)。ADMIN 限定。
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  const body = await req.json().catch(() => null);
  const { name, color } = (body ?? {}) as { name?: string; color?: unknown };
  const res = await updateLabel(id, { name, color });
  if (res.kind === "ok") {
    await recordAdminAudit({ actorId: gate.actor.operatorId, action: "LABEL_UPDATED", targetType: "label", targetId: id, summary: name ?? null });
  }
  return toResponse(res);
}

// ラベル削除。ADMIN 限定。付与済みチケットとの関連は自動解消。
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const gate = await requireAdmin();
  if (!gate.ok) return gate.res;

  const res = await deleteLabel(id);
  if (res.kind === "ok") {
    await recordAdminAudit({ actorId: gate.actor.operatorId, action: "LABEL_DELETED", targetType: "label", targetId: id });
  }
  return toResponse(res);
}
