import { NextRequest, NextResponse } from "next/server";
import { changeAssignee } from "@/lib/ops/ops-repo";
import { opResultToResponse } from "@/lib/ops/http";
import type { Actor } from "@/lib/ops/types";
import type { Role } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

// セキュリティ注記: 認証は未実装(Phase 5)。operatorId/role はボディを信頼する。公開前に必ずゲートすること。
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const { operatorId, role, assigneeId } = (body ?? {}) as { operatorId?: string; role?: Role; assigneeId?: string | null };
  if (!operatorId || !role || assigneeId === undefined) {
    return NextResponse.json({ ok: false, error: "operatorId, role, assigneeId(またはnull) が必要です" }, { status: 400 });
  }
  const actor: Actor = { operatorId, role };
  return opResultToResponse(await changeAssignee({ ticketId: id, actor, assigneeId }));
}
