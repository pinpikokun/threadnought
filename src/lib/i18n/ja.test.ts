import { describe, it, expect } from "vitest";
import { t } from "./ja";

describe("i18n ラベル", () => {
  it("方向ラベル", () => {
    expect(t.directionLabel.INBOUND).toBe("受信");
    expect(t.directionLabel.OUTBOUND).toBe("送信");
  });
  it("メモ種別ラベル", () => {
    expect(t.noteTypeLabel.INTERNAL_NOTE).toBe("社内メモ");
    expect(t.noteTypeLabel.EXTERNAL_LOG).toBe("外部ログ");
  });
  it("監査アクションラベルが8種そろう", () => {
    expect(Object.keys(t.auditLabel).sort()).toEqual(
      ["ASSIGNEE_CHANGED", "LABEL_ADDED", "LABEL_REMOVED", "MERGED", "REOPENED", "REPLIED", "SPLIT", "STATUS_CHANGED"],
    );
  });
});
