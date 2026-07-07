import { describe, it, expect } from "vitest";
import { validateNewOperator, validatePassword, isValidRole } from "./validation";

describe("isValidRole", () => {
  it("ADMIN/DISPATCHER/MEMBER を受理し、それ以外を拒否", () => {
    expect(isValidRole("ADMIN")).toBe(true);
    expect(isValidRole("DISPATCHER")).toBe(true);
    expect(isValidRole("MEMBER")).toBe(true);
    expect(isValidRole("SUPERUSER")).toBe(false);
    expect(isValidRole("")).toBe(false);
    expect(isValidRole(undefined)).toBe(false);
    expect(isValidRole(123)).toBe(false);
  });
});

describe("validateNewOperator", () => {
  const base = { username: "tanaka", displayName: "田中", password: "password", role: "MEMBER" };

  it("妥当な入力は ok", () => {
    expect(validateNewOperator(base)).toEqual({ ok: true });
  });

  it("username が空(空白のみ含む)なら invalid", () => {
    expect(validateNewOperator({ ...base, username: "   " }).ok).toBe(false);
  });

  it("username に空白が含まれるなら invalid", () => {
    expect(validateNewOperator({ ...base, username: "ta naka" }).ok).toBe(false);
  });

  it("displayName が空なら invalid", () => {
    expect(validateNewOperator({ ...base, displayName: "  " }).ok).toBe(false);
  });

  it("パスワードが8文字未満なら invalid", () => {
    expect(validateNewOperator({ ...base, password: "short7!" }).ok).toBe(false);
  });

  it("ロールが不正なら invalid", () => {
    expect(validateNewOperator({ ...base, role: "GOD" }).ok).toBe(false);
  });
});

describe("validatePassword", () => {
  it("8文字以上は ok、未満は invalid", () => {
    expect(validatePassword("password").ok).toBe(true);
    expect(validatePassword("short").ok).toBe(false);
  });
});
