import { describe, it, expect } from "vitest";
import { listTickets } from "./tickets";

describe("listTickets", () => {
  it("シード済みのチケットを一覧用の形で返す", async () => {
    const tickets = await listTickets();
    expect(tickets.length).toBeGreaterThanOrEqual(2);
    const t = tickets.find((x) => x.caseNumber === "SUP-000001");
    expect(t).toBeTruthy();
    expect(t!.title).toBe("お問い合わせの件");
    expect(t!.assigneeName).toBe("田中");
    expect(t!.messageCount).toBe(1);
  });
});
