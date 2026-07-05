import { NextRequest, NextResponse } from "next/server";
import { splitMessage } from "@/lib/ops/ops-repo";
import { opResultToResponse } from "@/lib/ops/http";
import type { Actor } from "@/lib/ops/types";
import type { Role } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

// セキュリティ注記: 認証は未実装(Phase 5)。operatorId/role はボディを信頼する。公開前に必ずゲートすること。
// id = 分割元チケット。body.messageId = 新チケットへ切り出すメール。
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const { operatorId, role, messageId } = (body ?? {}) as { operatorId?: string; role?: Role; messageId?: string };
  if (!operatorId || !role || !messageId) {
    return NextResponse.json({ ok: false, error: "operatorId, role, messageId が必要です" }, { status: 400 });
  }
  const actor: Actor = { operatorId, role };
  const res = await splitMessage({ ticketId: id, messageId, actor });
  if (res.kind === "ok") {
    return NextResponse.json({ ok: true, newTicketId: res.newTicketId, caseNumber: res.caseNumber });
  }
  return opResultToResponse(res);
}
