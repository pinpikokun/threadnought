-- pg_trgm 拡張（trigram類似度と ILIKE 高速化）
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 検索対象列の GIN trigram インデックス
CREATE INDEX IF NOT EXISTS "Ticket_title_trgm_idx" ON "Ticket" USING gin ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Ticket_subject_trgm_idx" ON "Ticket" USING gin ("subject" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Ticket_caseNumber_trgm_idx" ON "Ticket" USING gin ("caseNumber" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Ticket_token_trgm_idx" ON "Ticket" USING gin ("token" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Message_subject_trgm_idx" ON "Message" USING gin ("subject" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Message_bodyText_trgm_idx" ON "Message" USING gin ("bodyText" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Message_fromAddr_trgm_idx" ON "Message" USING gin ("fromAddr" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Contact_email_trgm_idx" ON "Contact" USING gin ("email" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Contact_name_trgm_idx" ON "Contact" USING gin ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Contact_company_trgm_idx" ON "Contact" USING gin ("company" gin_trgm_ops);
