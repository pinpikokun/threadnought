import { NextResponse } from "next/server";
import type { OpResult } from "./types";

// OpResult を HTTP レスポンスへ写像する。
export function opResultToResponse(result: OpResult): NextResponse {
  switch (result.kind) {
    case "ok":
      return NextResponse.json({ ok: true, changed: result.changed });
    case "not_found":
      return NextResponse.json({ ok: false, error: "対象が見つかりません" }, { status: 404 });
    case "forbidden":
      return NextResponse.json({ ok: false, error: "権限がありません" }, { status: 403 });
    case "invalid":
      return NextResponse.json({ ok: false, error: result.reason }, { status: 400 });
  }
}
