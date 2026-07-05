import { NextRequest, NextResponse } from "next/server";
import { addNote } from "@/lib/ops/ops-repo";
import { opResultToResponse } from "@/lib/ops/http";
import { getCurrentActor } from "@/lib/auth/current";
import { assertTicketAccess } from "@/lib/auth/access";
import type { NoteType } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getCurrentActor();
  if (!actor) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const access = await assertTicketAccess(actor, id);
  if (access === "not_found") return NextResponse.json({ ok: false, error: "対象が見つかりません" }, { status: 404 });
  if (access === "forbidden") return NextResponse.json({ ok: false, error: "権限がありません" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const { type, body: noteBody } = (body ?? {}) as { type?: NoteType; body?: string };
  if ((type !== "INTERNAL_NOTE" && type !== "EXTERNAL_LOG") || !noteBody) {
    return NextResponse.json({ ok: false, error: "type(INTERNAL_NOTE|EXTERNAL_LOG), body が必要です" }, { status: 400 });
  }
  return opResultToResponse(await addNote({ ticketId: id, actor, type, body: noteBody }));
}
