import { NextRequest, NextResponse } from "next/server";
import { splitMessage } from "@/lib/ops/ops-repo";
import { opResultToResponse } from "@/lib/ops/http";
import { getCurrentActor } from "@/lib/auth/current";
import { assertTicketAccess } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

// id = 分割元チケット。body.messageId = 新チケットへ切り出すメール。
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getCurrentActor();
  if (!actor) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const access = await assertTicketAccess(actor, id);
  if (access === "not_found") return NextResponse.json({ ok: false, error: "対象が見つかりません" }, { status: 404 });
  if (access === "forbidden") return NextResponse.json({ ok: false, error: "権限がありません" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const { messageId } = (body ?? {}) as { messageId?: string };
  if (!messageId) return NextResponse.json({ ok: false, error: "messageId が必要です" }, { status: 400 });

  const res = await splitMessage({ ticketId: id, messageId, actor });
  if (res.kind === "ok") {
    return NextResponse.json({ ok: true, newTicketId: res.newTicketId, caseNumber: res.caseNumber });
  }
  return opResultToResponse(res);
}
