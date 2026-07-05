import { NextRequest, NextResponse } from "next/server";
import { mergeTickets } from "@/lib/ops/ops-repo";
import { opResultToResponse } from "@/lib/ops/http";
import { getCurrentActor } from "@/lib/auth/current";
import { assertTicketAccess } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

// id = 統合元(source)。body.targetId = 統合先。source の全メール・メモが target に移る。
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getCurrentActor();
  if (!actor) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const { targetId } = (body ?? {}) as { targetId?: string };
  if (!targetId) return NextResponse.json({ ok: false, error: "targetId が必要です" }, { status: 400 });

  // 統合は両チケットに触れるため、両方の窓口権限を要求する。
  for (const ticketId of [id, targetId]) {
    const access = await assertTicketAccess(actor, ticketId);
    if (access === "not_found") return NextResponse.json({ ok: false, error: "対象が見つかりません" }, { status: 404 });
    if (access === "forbidden") return NextResponse.json({ ok: false, error: "権限がありません" }, { status: 403 });
  }

  return opResultToResponse(await mergeTickets({ sourceId: id, targetId, actor }));
}
