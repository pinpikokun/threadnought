import { describe, it, expect } from "vitest";
import { parseAddressList, isLikelyEmail } from "./address-input";

describe("parseAddressList", () => {
  it("カンマ区切りを分割し空白を除去する", () => {
    expect(parseAddressList("a@x.com, b@y.com")).toEqual([{ address: "a@x.com" }, { address: "b@y.com" }]);
  });
  it("改行区切りも扱い、空要素を落とす", () => {
    expect(parseAddressList("a@x.com\n\n b@y.com \n")).toEqual([{ address: "a@x.com" }, { address: "b@y.com" }]);
  });
  it("空白のみは空配列", () => {
    expect(parseAddressList("   ")).toEqual([]);
  });
});

describe("isLikelyEmail", () => {
  it("正当なアドレスは true", () => {
    expect(isLikelyEmail("a@x.com")).toBe(true);
  });
  it("@無し/二重@/末尾@/先頭@/空白入りは false", () => {
    expect(isLikelyEmail("ax.com")).toBe(false);
    expect(isLikelyEmail("a@@x.com")).toBe(false);
    expect(isLikelyEmail("a@")).toBe(false);
    expect(isLikelyEmail("@x.com")).toBe(false);
    expect(isLikelyEmail("a @x.com")).toBe(false);
  });
});
