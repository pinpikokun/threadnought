import { describe, it, expect } from "vitest";
import { buildTimeline } from "./timeline";

describe("buildTimeline", () => {
  it("メール・メモ・監査を時系列昇順で1本に統合する", () => {
    const items = buildTimeline({
      messages: [
        { id: "m1", sentAt: new Date("2026-06-26T10:00:00Z"), direction: "INBOUND", fromAddr: "c@x.com", subject: "件名", bodyText: "本文" },
        { id: "m2", sentAt: new Date("2026-06-26T12:00:00Z"), direction: "OUTBOUND", fromAddr: "s@x.com", subject: "Re: 件名", bodyText: "返信" },
      ],
      notes: [
        { id: "n1", occurredAt: new Date("2026-06-26T11:00:00Z"), type: "INTERNAL_NOTE", authorName: "田中", body: "社内メモ" },
      ],
      audits: [
        { id: "a1", createdAt: new Date("2026-06-26T12:00:00Z"), action: "STATUS_CHANGED", actorName: "田中", fromValue: "UNHANDLED", toValue: "IN_PROGRESS" },
      ],
    });
    expect(items.map((i) => [i.kind, i.id])).toEqual([
      ["message", "m1"],
      ["note", "n1"],
      // 同時刻はメール→メモ→監査の順で決定的に並ぶ
      ["message", "m2"],
      ["audit", "a1"],
    ]);
  });

  it("各種目の中身を正しく写像する", () => {
    const items = buildTimeline({
      messages: [{ id: "m1", sentAt: new Date("2026-06-26T10:00:00Z"), direction: "INBOUND", fromAddr: "c@x.com", subject: "件名", bodyText: null }],
      notes: [{ id: "n1", occurredAt: new Date("2026-06-26T10:30:00Z"), type: "EXTERNAL_LOG", authorName: "佐藤", body: "電話対応" }],
      audits: [{ id: "a1", createdAt: new Date("2026-06-26T11:00:00Z"), action: "REPLIED", actorName: "佐藤", fromValue: null, toValue: null }],
    });
    expect(items[0]).toEqual({ kind: "message", id: "m1", at: new Date("2026-06-26T10:00:00Z"), direction: "INBOUND", fromAddr: "c@x.com", subject: "件名", bodyText: null });
    expect(items[1]).toEqual({ kind: "note", id: "n1", at: new Date("2026-06-26T10:30:00Z"), noteType: "EXTERNAL_LOG", authorName: "佐藤", body: "電話対応" });
    expect(items[2]).toEqual({ kind: "audit", id: "a1", at: new Date("2026-06-26T11:00:00Z"), action: "REPLIED", actorName: "佐藤", fromValue: null, toValue: null });
  });
});
