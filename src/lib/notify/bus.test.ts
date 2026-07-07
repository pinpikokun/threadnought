import { describe, it, expect } from "vitest";
import { publishNotification, subscribeNotifications, isEventVisibleTo, type NotifyEvent } from "./bus";

function makeEvent(over: Partial<NotifyEvent> = {}): NotifyEvent {
  return { type: "ticket_created", accountId: "acc1", ticketId: "t1", caseNumber: "SUP-1", title: "件名", at: 1, ...over };
}

describe("publish/subscribe", () => {
  it("購読者は発火したイベントを受け取る", () => {
    const received: NotifyEvent[] = [];
    const unsub = subscribeNotifications((e) => received.push(e));
    publishNotification(makeEvent({ ticketId: "tX" }));
    unsub();
    expect(received).toHaveLength(1);
    expect(received[0].ticketId).toBe("tX");
  });

  it("解除後は受け取らない", () => {
    const received: NotifyEvent[] = [];
    const unsub = subscribeNotifications((e) => received.push(e));
    unsub();
    publishNotification(makeEvent());
    expect(received).toHaveLength(0);
  });
});

describe("isEventVisibleTo", () => {
  it("ADMIN は全窓口のイベントが見える", () => {
    expect(isEventVisibleTo(makeEvent({ accountId: "any" }), { role: "ADMIN", accountIds: [] })).toBe(true);
  });
  it("非ADMINは所属窓口のみ", () => {
    const e = makeEvent({ accountId: "acc1" });
    expect(isEventVisibleTo(e, { role: "MEMBER", accountIds: ["acc1"] })).toBe(true);
    expect(isEventVisibleTo(e, { role: "MEMBER", accountIds: ["acc2"] })).toBe(false);
  });
});
