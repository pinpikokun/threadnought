import { describe, it, expect } from "vitest";
import { validateNewOperator, validatePassword, isValidRole, validateLabelName, normalizeColor, validateNewAccount, normalizeSignature } from "./validation";

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

describe("validateLabelName", () => {
  it("非空は ok、空白のみ/長すぎは invalid", () => {
    expect(validateLabelName("緊急").ok).toBe(true);
    expect(validateLabelName("   ").ok).toBe(false);
    expect(validateLabelName("あ".repeat(41)).ok).toBe(false);
  });
});

describe("normalizeColor", () => {
  it("空文字/非文字列は null、hex はそのまま", () => {
    expect(normalizeColor("#ff0000")).toBe("#ff0000");
    expect(normalizeColor("  ")).toBeNull();
    expect(normalizeColor("")).toBeNull();
    expect(normalizeColor(undefined)).toBeNull();
    expect(normalizeColor(123)).toBeNull();
  });
});

describe("validateNewAccount", () => {
  it("name/casePrefix が妥当なら ok", () => {
    expect(validateNewAccount({ name: "サポート窓口", casePrefix: "SUP" }).ok).toBe(true);
    expect(validateNewAccount({ name: "A", casePrefix: "A-1" }).ok).toBe(true);
  });
  it("name 空・prefix 空/空白含む/記号は invalid", () => {
    expect(validateNewAccount({ name: "  ", casePrefix: "SUP" }).ok).toBe(false);
    expect(validateNewAccount({ name: "X", casePrefix: "  " }).ok).toBe(false);
    expect(validateNewAccount({ name: "X", casePrefix: "SU P" }).ok).toBe(false);
    expect(validateNewAccount({ name: "X", casePrefix: "SUP!" }).ok).toBe(false);
  });
});

describe("normalizeSignature", () => {
  it("undefined は skip、空文字は null、文字列はそのまま", () => {
    expect(normalizeSignature(undefined)).toBeUndefined();
    expect(normalizeSignature("")).toBeNull();
    expect(normalizeSignature("敬具")).toBe("敬具");
    expect(normalizeSignature(123)).toBeNull();
  });
});
