import { NextRequest, NextResponse } from "next/server";
import { getCurrentActor } from "@/lib/auth/current";
import { updateAccount } from "@/lib/admin/admin-repo";

export const dynamic = "force-dynamic";

// 窓口更新(name/signature のみ・casePrefix は不変)。ADMIN 限定。
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getCurrentActor();
  if (!actor) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (actor.role !== "ADMIN") return NextResponse.json({ ok: false, error: "権限がありません" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const { name, signature } = (body ?? {}) as { name?: string; signature?: unknown };

  const res = await updateAccount(id, { name, signature });
  if (res.kind === "ok") return NextResponse.json({ ok: true });
  if (res.kind === "invalid") return NextResponse.json({ ok: false, error: res.reason }, { status: 400 });
  return NextResponse.json({ ok: false, error: "対象が見つかりません" }, { status: 404 });
}
