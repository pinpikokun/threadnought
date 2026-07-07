import { describe, it, expect, vi, beforeEach } from "vitest";
import type { NextRequest } from "next/server";
import type { AppActor } from "@/lib/auth/current";

// Phase 5 繰越(M5): チケット操作系ルートの認証ゲート回帰テスト。
// getCurrentActor / assertTicketAccess をモックし、DB に触れず「未認証=401 /
// forbidden=403 / not_found=404」を各ルートで直接検証する。
// これらのゲートは本文パースやリポジトリ呼び出しより前に return するため、
// モックだけで到達でき、Neon への実クエリは発生しない。
vi.mock("@/lib/auth/current", () => ({ getCurrentActor: vi.fn() }));
vi.mock("@/lib/auth/access", () => ({ assertTicketAccess: vi.fn() }));

import { getCurrentActor } from "@/lib/auth/current";
import { assertTicketAccess } from "@/lib/auth/access";

import { POST as status } from "@/app/api/tickets/[id]/status/route";
import { POST as assignee } from "@/app/api/tickets/[id]/assignee/route";
import { POST as labels } from "@/app/api/tickets/[id]/labels/route";
import { POST as notes } from "@/app/api/tickets/[id]/notes/route";
import { POST as fields } from "@/app/api/tickets/[id]/fields/route";
import { POST as merge } from "@/app/api/tickets/[id]/merge/route";
import { POST as split } from "@/app/api/tickets/[id]/split/route";
import { POST as reply } from "@/app/api/tickets/[id]/reply/route";
import { GET as timeline } from "@/app/api/tickets/[id]/timeline/route";

const mockedActor = vi.mocked(getCurrentActor);
const mockedAccess = vi.mocked(assertTicketAccess);

type Handler = (
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) => Promise<Response>;

const routes: { name: string; fn: Handler }[] = [
  { name: "status", fn: status as Handler },
  { name: "assignee", fn: assignee as Handler },
  { name: "labels", fn: labels as Handler },
  { name: "notes", fn: notes as Handler },
  { name: "fields", fn: fields as Handler },
  { name: "merge", fn: merge as Handler },
  { name: "split", fn: split as Handler },
  { name: "reply", fn: reply as Handler },
  { name: "timeline", fn: timeline as Handler },
];

// 全ルートの必須フィールドを1つの body に同居させておく（merge は access 判定より前に
// targetId を読むため、これが無いと 400 で先に落ちてしまう）。他ルートは access を
// 先に判定するので余分なフィールドがあっても無害。
function call(fn: Handler) {
  const req = {
    json: async () => ({
      targetId: "t2",
      messageId: "m1",
      status: "DONE",
      assigneeId: null,
      type: "INTERNAL_NOTE",
      body: "x",
      op: "add",
      labelId: "l1",
      title: "件名",
    }),
  } as unknown as NextRequest;
  return fn(req, { params: Promise.resolve({ id: "t1" }) });
}

const AUTHED: AppActor = { operatorId: "op1", role: "MEMBER", accountIds: ["a1"] };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("チケット操作ルートの認証ゲート(M5回帰)", () => {
  for (const r of routes) {
    describe(r.name, () => {
      it("未認証は401", async () => {
        mockedActor.mockResolvedValue(null);
        const res = await call(r.fn);
        expect(res.status).toBe(401);
        // access 判定まで到達していない（認証で即 return）
        expect(mockedAccess).not.toHaveBeenCalled();
      });

      it("アクセス外窓口は403", async () => {
        mockedActor.mockResolvedValue(AUTHED);
        mockedAccess.mockResolvedValue("forbidden");
        const res = await call(r.fn);
        expect(res.status).toBe(403);
      });

      it("存在しないチケットは404", async () => {
        mockedActor.mockResolvedValue(AUTHED);
        mockedAccess.mockResolvedValue("not_found");
        const res = await call(r.fn);
        expect(res.status).toBe(404);
      });
    });
  }
});
