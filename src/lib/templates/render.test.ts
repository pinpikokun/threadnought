import { describe, it, expect } from "vitest";
import { renderTemplate } from "./render";

describe("renderTemplate", () => {
  it("{{キー}} を値に置換する（空白許容）", () => {
    const out = renderTemplate("{{顧客名}}様\nチケット {{ チケット番号 }} を承りました。\n担当: {{担当者名}}", {
      顧客名: "山田",
      チケット番号: "SUP-000001",
      担当者名: "田中",
    });
    expect(out).toBe("山田様\nチケット SUP-000001 を承りました。\n担当: 田中");
  });

  it("未定義キーは空文字に置換する", () => {
    expect(renderTemplate("[{{未知}}]終わり", {})).toBe("[]終わり");
  });
});
