import { promises as fs } from "node:fs";
import path from "node:path";
import type { StorageProvider } from "./provider";

// ローカルFS上に添付実体を保存する標準アダプター。追加依存なし。
export class FsStorageProvider implements StorageProvider {
  constructor(private baseDir: string) {}

  // key を baseDir 配下に解決。ベースディレクトリ外への脱出を防ぐ。
  private resolve(key: string): string {
    const base = path.resolve(this.baseDir);
    const full = path.resolve(base, key);
    if (full !== base && !full.startsWith(base + path.sep)) {
      throw new Error(`invalid storage key: ${key}`);
    }
    return full;
  }

  async put(key: string, data: Buffer): Promise<void> {
    const full = this.resolve(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
  }

  async get(key: string): Promise<Buffer> {
    return fs.readFile(this.resolve(key));
  }

  async delete(key: string): Promise<void> {
    await fs.rm(this.resolve(key), { force: true });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }
}
