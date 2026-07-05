import { NextRequest, NextResponse } from "next/server";
import { loadTimeline } from "@/lib/ops/ops-repo";
import { getCurrentActor } from "@/lib/auth/current";
import { assertTicketAccess } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getCurrentActor();
  if (!actor) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const access = await assertTicketAccess(actor, id);
  if (access === "not_found") return NextResponse.json({ ok: false, error: "対象が見つかりません" }, { status: 404 });
  if (access === "forbidden") return NextResponse.json({ ok: false, error: "権限がありません" }, { status: 403 });

  const items = await loadTimeline(id);
  if (items === null) {
    return NextResponse.json({ ok: false, error: "対象が見つかりません" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, items });
}
