import { describe, it, expect, afterAll } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { FsStorageProvider } from "./fs-adapter";

const baseDir = path.join(os.tmpdir(), "threadnought-storage-test-T1");
const store = new FsStorageProvider(baseDir);

afterAll(async () => {
  await fs.rm(baseDir, { recursive: true, force: true });
});

describe("FsStorageProvider", () => {
  it("put した内容を get で取り出せる", async () => {
    await store.put("k1", Buffer.from("hello"));
    const got = await store.get("k1");
    expect(got.toString()).toBe("hello");
  });

  it("exists は有無を返す", async () => {
    await store.put("k2", Buffer.from("x"));
    expect(await store.exists("k2")).toBe(true);
    expect(await store.exists("nope")).toBe(false);
  });

  it("delete 後は exists=false", async () => {
    await store.put("k3", Buffer.from("y"));
    await store.delete("k3");
    expect(await store.exists("k3")).toBe(false);
  });

  it("delete は存在しないキーでも例外を投げない", async () => {
    await expect(store.delete("ghost")).resolves.toBeUndefined();
  });

  it("ベースディレクトリ外へ脱出するキーは拒否", async () => {
    await expect(store.put("../evil", Buffer.from("z"))).rejects.toThrow();
    await expect(store.get("../../etc/passwd")).rejects.toThrow();
  });
});
