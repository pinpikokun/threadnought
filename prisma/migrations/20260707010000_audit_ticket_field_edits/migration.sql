-- AlterEnum
-- チケットの件名/ピン留め/期日編集を監査するための AuditAction 値を追加する。
-- 純粋な ADD VALUE のみ(既存値の変更・削除なし)。IF NOT EXISTS で再適用に安全。
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'TITLE_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'PINNED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'UNPINNED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'DUE_DATE_CHANGED';
