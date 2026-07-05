import type { ParsedAttachment } from "./types";

// mailparser の Attachment のうち本アプリが使う部分だけを表す最小型。
export type RawMailparserAttachment = {
  filename?: string;
  contentType?: string;
  content: Buffer;
  size?: number;
  cid?: string;
  contentDisposition?: string;
};

// cid は "<abc@host>" 形式で来ることがあるため両端の <> を落とす。
function stripCid(cid: string | undefined): string | undefined {
  if (!cid) return undefined;
  return cid.replace(/^<|>$/g, "");
}

export function mapParsedAttachments(raw: RawMailparserAttachment[]): ParsedAttachment[] {
  return raw.map((a) => {
    const contentId = stripCid(a.cid);
    const inline = a.contentDisposition === "inline" || Boolean(contentId);
    return {
      filename: a.filename ?? "attachment",
      contentType: a.contentType ?? "application/octet-stream",
      content: a.content,
      size: a.size ?? a.content.length,
      contentId,
      inline,
    };
  });
}
