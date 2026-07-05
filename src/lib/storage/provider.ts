// 添付実体の保存ポート。標準アダプター=ローカルFS。S3等は将来のプラグイン。
export interface StorageProvider {
  put(key: string, data: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
}
