import { NextRequest, NextResponse } from "next/server";
import { changeStatus } from "@/lib/ops/ops-repo";
import { opResultToResponse } from "@/lib/ops/http";
import type { Actor } from "@/lib/ops/types";
import type { TicketStatus, Role } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const VALID_STATUS: TicketStatus[] = ["UNHANDLED", "IN_PROGRESS", "DONE"];

// セキュリティ注記: 認証は未実装(Phase 5)。operatorId/role はボディを信頼する。公開前に必ずゲートすること。
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const { operatorId, role, status } = (body ?? {}) as { operatorId?: string; role?: Role; status?: TicketStatus };
  if (!operatorId || !role || !status) {
    return NextResponse.json({ ok: false, error: "operatorId, role, status が必要です" }, { status: 400 });
  }
  if (!VALID_STATUS.includes(status)) {
    return NextResponse.json({ ok: false, error: `status は ${VALID_STATUS.join(", ")} のいずれかである必要があります` }, { status: 400 });
  }
  const actor: Actor = { operatorId, role };
  return opResultToResponse(await changeStatus({ ticketId: id, actor, status }));
}
