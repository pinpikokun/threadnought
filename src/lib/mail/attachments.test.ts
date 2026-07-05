import { describe, it, expect } from "vitest";
import { mapParsedAttachments } from "./attachments";

describe("mapParsedAttachments", () => {
  it("通常の添付を素直に写す", () => {
    const out = mapParsedAttachments([
      { filename: "a.pdf", contentType: "application/pdf", content: Buffer.from("pdf"), size: 3 },
    ]);
    expect(out).toEqual([
      { filename: "a.pdf", contentType: "application/pdf", content: Buffer.from("pdf"), size: 3, contentId: undefined, inline: false },
    ]);
  });

  it("cid があれば inline=true・contentId から <> を除去", () => {
    const out = mapParsedAttachments([
      { filename: "logo.png", contentType: "image/png", content: Buffer.from("img"), cid: "<abc@x>", size: 3 },
    ]);
    expect(out[0].inline).toBe(true);
    expect(out[0].contentId).toBe("abc@x");
  });

  it("contentDisposition=inline でも inline=true", () => {
    const out = mapParsedAttachments([
      { filename: "x.png", contentType: "image/png", content: Buffer.from("y"), contentDisposition: "inline", size: 1 },
    ]);
    expect(out[0].inline).toBe(true);
  });

  it("filename 欠落は 'attachment' に、contentType 欠落は octet-stream に、size 欠落は content 長に", () => {
    const out = mapParsedAttachments([
      { content: Buffer.from("hello") },
    ]);
    expect(out[0].filename).toBe("attachment");
    expect(out[0].contentType).toBe("application/octet-stream");
    expect(out[0].size).toBe(5);
    expect(out[0].inline).toBe(false);
  });

  it("空配列は空配列", () => {
    expect(mapParsedAttachments([])).toEqual([]);
  });
});
