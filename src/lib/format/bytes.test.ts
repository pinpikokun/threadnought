import { describe, it, expect } from "vitest";
import { formatBytes } from "./bytes";

describe("formatBytes", () => {
  it("バイト未満/バイト/KB/MB を人間可読へ整形する", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(1048576)).toBe("1.0 MB");
  });
  it("負数や非有限は 0 B", () => {
    expect(formatBytes(-5)).toBe("0 B");
    expect(formatBytes(NaN)).toBe("0 B");
  });
});
