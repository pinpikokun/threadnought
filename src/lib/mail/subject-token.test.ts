import { describe, it, expect } from "vitest";
import { parseCaseNumber } from "./subject-token";

describe("parseCaseNumber", () => {
  it("件名内のチケット番号 PREFIX-000123 を抽出する", () => {
    expect(parseCaseNumber("Re: 在庫の件 [SUP-000042]")).toBe("SUP-000042");
    expect(parseCaseNumber("A-000007 についての返信")).toBe("A-000007");
  });
  it("番号が無ければ null", () => {
    expect(parseCaseNumber("ただの件名")).toBeNull();
  });
});
