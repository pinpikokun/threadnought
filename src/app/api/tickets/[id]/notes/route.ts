import { NextRequest, NextResponse } from "next/server";
import { addNote } from "@/lib/ops/ops-repo";
import { opResultToResponse } from "@/lib/ops/http";
import type { Actor } from "@/lib/ops/types";
import type { Role, NoteType } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

// セキュリティ注記: 認証は未実装(Phase 5)。operatorId/role はボディを信頼する。公開前に必ずゲートすること。
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const { operatorId, role, type, body: noteBody } = (body ?? {}) as { operatorId?: string; role?: Role; type?: NoteType; body?: string };
  if (!operatorId || !role || (type !== "INTERNAL_NOTE" && type !== "EXTERNAL_LOG") || !noteBody) {
    return NextResponse.json({ ok: false, error: "operatorId, role, type(INTERNAL_NOTE|EXTERNAL_LOG), body が必要です" }, { status: 400 });
  }
  const actor: Actor = { operatorId, role };
  return opResultToResponse(await addNote({ ticketId: id, actor, type, body: noteBody }));
}
