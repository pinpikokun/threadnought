import { describe, it, expect } from "vitest";
import { FakeMailReceiver, makeEmail } from "./fakes";

describe("FakeMailReceiver", () => {
  it("fetchNew は与えたメールを返し、markProcessed は uid を記録する", async () => {
    const r = new FakeMailReceiver([makeEmail({ messageId: "<a@x>" })]);
    expect((await r.fetchNew()).length).toBe(1);
    await r.markProcessed(["<a@x>"]);
    expect(r.processed).toEqual(["<a@x>"]);
  });
});
