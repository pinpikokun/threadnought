import { NextRequest, NextResponse } from "next/server";
import { updateTicketFields } from "@/lib/ops/ops-repo";
import { opResultToResponse } from "@/lib/ops/http";
import { getCurrentActor } from "@/lib/auth/current";
import { assertTicketAccess } from "@/lib/auth/access";

export const dynamic = "force-dynamic";

// チケットの件名/ピン留め/期日を部分更新する。body に含まれた項目のみ更新。
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getCurrentActor();
  if (!actor) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const access = await assertTicketAccess(actor, id);
  if (access === "not_found") return NextResponse.json({ ok: false, error: "対象が見つかりません" }, { status: 404 });
  if (access === "forbidden") return NextResponse.json({ ok: false, error: "権限がありません" }, { status: 403 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 400 });
  }
  const b = body as { title?: unknown; isPinned?: unknown; dueDate?: unknown };

  return opResultToResponse(
    await updateTicketFields({
      ticketId: id,
      actorId: actor.operatorId,
      title: typeof b.title === "string" ? b.title : undefined,
      isPinned: typeof b.isPinned === "boolean" ? b.isPinned : undefined,
      dueDate:
        b.dueDate === null
          ? null
          : typeof b.dueDate === "string"
            ? b.dueDate
            : undefined,
    }),
  );
}
