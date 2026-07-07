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
  it("監査アクションラベルが12種そろう", () => {
    expect(Object.keys(t.auditLabel).sort()).toEqual(
      ["ASSIGNEE_CHANGED", "DUE_DATE_CHANGED", "LABEL_ADDED", "LABEL_REMOVED", "MERGED", "PINNED", "REOPENED", "REPLIED", "SPLIT", "STATUS_CHANGED", "TITLE_CHANGED", "UNPINNED"],
    );
  });
  it("ADMIN監査ラベルが8種そろう", () => {
    expect(Object.keys(t.adminAuditLabel).sort()).toEqual(
      ["ACCOUNT_CREATED", "ACCOUNT_UPDATED", "LABEL_CREATED", "LABEL_DELETED", "LABEL_UPDATED", "OPERATOR_CREATED", "OPERATOR_PASSWORD_RESET", "OPERATOR_UPDATED"],
    );
  });
  it("ADMIN対象種別ラベル", () => {
    expect(t.adminTargetLabel.operator).toBe("オペレータ");
    expect(t.adminTargetLabel.label).toBe("ラベル");
    expect(t.adminTargetLabel.account).toBe("窓口");
  });
});
