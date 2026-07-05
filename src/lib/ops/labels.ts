import type { Decision } from "./types";

export function decideLabelChange(input: {
  currentLabelIds: string[];
  op: "add" | "remove";
  labelId: string;
}): Decision<{ op: "add" | "remove"; labelId: string }> {
  const has = input.currentLabelIds.includes(input.labelId);
  if (input.op === "add") {
    if (has) return { kind: "noop" };
    return {
      kind: "apply",
      patch: { op: "add", labelId: input.labelId },
      audits: [{ action: "LABEL_ADDED", toValue: input.labelId }],
    };
  }
  if (!has) return { kind: "noop" };
  return {
    kind: "apply",
    patch: { op: "remove", labelId: input.labelId },
    audits: [{ action: "LABEL_REMOVED", fromValue: input.labelId }],
  };
}
