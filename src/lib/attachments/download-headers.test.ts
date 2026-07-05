import { describe, expect, it } from "vitest";
import { buildDownloadHeaders } from "./download-headers";

describe("buildDownloadHeaders", () => {
  it("always uses attachment disposition, never inline", () => {
    const headers = buildDownloadHeaders({ filename: "a.txt", contentType: "text/plain" }, 3);
    expect(headers["Content-Disposition"]).toMatch(/^attachment;/);
    expect(headers["Content-Disposition"]).not.toContain("inline");
  });

  it("sets X-Content-Type-Options to nosniff", () => {
    const headers = buildDownloadHeaders({ filename: "a.txt", contentType: "text/plain" }, 3);
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
  });

  it("sets a restrictive Content-Security-Policy", () => {
    const headers = buildDownloadHeaders({ filename: "a.txt", contentType: "text/plain" }, 3);
    expect(headers["Content-Security-Policy"]).toBe("default-src 'none'; sandbox");
  });

  it("percent-encodes non-ASCII/space filenames in filename*", () => {
    const headers = buildDownloadHeaders(
      { filename: "領収書 2.pdf", contentType: "application/pdf" },
      10
    );
    expect(headers["Content-Disposition"]).toBe(
      `attachment; filename*=UTF-8''${encodeURIComponent("領収書 2.pdf")}`
    );
  });

  it("sets Content-Length to the given byte length as a string", () => {
    const headers = buildDownloadHeaders({ filename: "a.txt", contentType: "text/plain" }, 12345);
    expect(headers["Content-Length"]).toBe("12345");
  });
});
