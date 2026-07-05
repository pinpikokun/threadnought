import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword } from "./password";

describe("password hashing (scrypt)", () => {
  it("同じパスワードを検証できる", async () => {
    const stored = await hashPassword("s3cret-pass");
    expect(await verifyPassword("s3cret-pass", stored)).toBe(true);
  });

  it("違うパスワードは弾く", async () => {
    const stored = await hashPassword("s3cret-pass");
    expect(await verifyPassword("wrong-pass", stored)).toBe(false);
  });

  it("毎回ソルトが変わり同じ入力でもハッシュが異なる", async () => {
    const a = await hashPassword("same");
    const b = await hashPassword("same");
    expect(a).not.toEqual(b);
    expect(await verifyPassword("same", a)).toBe(true);
    expect(await verifyPassword("same", b)).toBe(true);
  });

  it("形式が壊れた stored は false（例外を投げない）", async () => {
    expect(await verifyPassword("x", "")).toBe(false);
    expect(await verifyPassword("x", "no-colon")).toBe(false);
    expect(await verifyPassword("x", "zz:zz")).toBe(false);
  });
});
