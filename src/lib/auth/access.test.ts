import { describe, it, expect } from "vitest";
import { canAccessAccount } from "./access";

describe("canAccessAccount", () => {
  it("ADMIN はどの窓口にもアクセスできる", () => {
    expect(canAccessAccount({ role: "ADMIN", accountIds: [] }, "acc-1")).toBe(true);
  });

  it("非ADMINは accountIds に含まれる窓口のみ", () => {
    expect(canAccessAccount({ role: "MEMBER", accountIds: ["acc-1", "acc-2"] }, "acc-1")).toBe(true);
    expect(canAccessAccount({ role: "MEMBER", accountIds: ["acc-1", "acc-2"] }, "acc-9")).toBe(false);
  });

  it("非ADMINで accountIds が空なら何も見えない", () => {
    expect(canAccessAccount({ role: "DISPATCHER", accountIds: [] }, "acc-1")).toBe(false);
  });
});
