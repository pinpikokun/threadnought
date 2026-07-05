import { NextResponse } from "next/server";
import { getCurrentActor } from "@/lib/auth/current";
import { assertAttachmentAccess } from "@/lib/auth/access";
import { storage } from "@/lib/storage";
import { buildDownloadHeaders } from "@/lib/attachments/download-headers";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await getCurrentActor();
  if (!actor) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const { result, attachment } = await assertAttachmentAccess(actor, id);
  if (result === "not_found") return NextResponse.json({ ok: false, error: "対象が見つかりません" }, { status: 404 });
  if (result === "forbidden") return NextResponse.json({ ok: false, error: "権限がありません" }, { status: 403 });

  let data: Buffer;
  try {
    data = await storage.get(attachment!.storageKey);
  } catch {
    return NextResponse.json({ ok: false, error: "実体が見つかりません" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(data), {
    headers: buildDownloadHeaders(
      { filename: attachment!.filename, contentType: attachment!.contentType },
      data.length
    ),
  });
}
