import { describe, it, expect } from "vitest";
import { ingestEmail } from "./ingest";
import { FakeIngestRepository, makeEmail } from "./fakes";

describe("ingestEmail", () => {
  it("参照なしの新着 → 新規チケット作成", async () => {
    const repo = new FakeIngestRepository();
    const r = await ingestEmail(makeEmail({ messageId: "<a@x>", subject: "在庫の件" }), { accountId: "ACC", prefix: "SUP" }, repo);
    expect(r).toEqual({ kind: "created", ticketId: "T1", caseNumber: "SUP-000001" });
  });

  it("返信(References一致) → 既存チケットに追加", async () => {
    const repo = new FakeIngestRepository([{ id: "T1", caseNumber: "SUP-000001", status: "IN_PROGRESS", messageIds: ["<a@x>"] }]);
    const r = await ingestEmail(makeEmail({ messageId: "<b@x>", references: ["<a@x>"] }), { accountId: "ACC", prefix: "SUP" }, repo);
    expect(r).toEqual({ kind: "appended", ticketId: "T1", reopened: false });
  });

  it("同じMessage-IDの再受信 → 重複スキップ", async () => {
    const repo = new FakeIngestRepository([{ id: "T1", caseNumber: "SUP-000001", status: "IN_PROGRESS", messageIds: ["<a@x>"] }]);
    const r = await ingestEmail(makeEmail({ messageId: "<a@x>" }), { accountId: "ACC", prefix: "SUP" }, repo);
    expect(r).toEqual({ kind: "skipped_duplicate", messageId: "<a@x>" });
  });

  it("完了チケットへの返信 → 再オープン", async () => {
    const repo = new FakeIngestRepository([{ id: "T1", caseNumber: "SUP-000001", status: "DONE", messageIds: ["<a@x>"] }]);
    const r = await ingestEmail(makeEmail({ messageId: "<b@x>", references: ["<a@x>"] }), { accountId: "ACC", prefix: "SUP" }, repo);
    expect(r).toEqual({ kind: "appended", ticketId: "T1", reopened: true });
  });
});
