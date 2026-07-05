import { NextRequest, NextResponse } from "next/server";
import { changeStatus } from "@/lib/ops/ops-repo";
import { opResultToResponse } from "@/lib/ops/http";
import { getCurrentActor } from "@/lib/auth/current";
import { assertTicketAccess } from "@/lib/auth/access";
import type { TicketStatus } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const VALID_STATUS: TicketStatus[] = ["UNHANDLED", "IN_PROGRESS", "DONE"];

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getCurrentActor();
  if (!actor) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const access = await assertTicketAccess(actor, id);
  if (access === "not_found") return NextResponse.json({ ok: false, error: "対象が見つかりません" }, { status: 404 });
  if (access === "forbidden") return NextResponse.json({ ok: false, error: "権限がありません" }, { status: 403 });

  const body = await req.json().catch(() => null);
  const { status } = (body ?? {}) as { status?: TicketStatus };
  if (!status) return NextResponse.json({ ok: false, error: "status が必要です" }, { status: 400 });
  if (!VALID_STATUS.includes(status)) {
    return NextResponse.json({ ok: false, error: `status は ${VALID_STATUS.join(", ")} のいずれかである必要があります` }, { status: 400 });
  }
  return opResultToResponse(await changeStatus({ ticketId: id, actor, status }));
}
