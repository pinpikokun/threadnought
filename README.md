# Threadnought 🧵⚓

**Turn a shared mailbox into a tidy ticket queue.** Threadnought pulls email from a real mailbox over IMAP and organizes it into **tickets** — threading replies together, numbering cases, de-duplicating, and automatically reopening a closed ticket when a customer writes back.

> A production-minded portfolio project, designed and built end-to-end with AI agents (Claude Code).

## Status — work in progress
- ✅ **Phase 1 · Foundation** — data model, database, ticket list
- ✅ **Phase 2 · Mail ingestion** — IMAP receive, thread-linking, case numbering, de-duplication, auto-reopen (validated against a real inbox)
- ✅ **Phase 3 · Replies** — SMTP send, reply composition (Re:/case-token/signature/quote), templates, auto-status/auto-assignee, audit trail, outbound persistence (real-DB integration test)
- ✅ **Phase 4 · Operations** — status/assignee/label changes, internal notes & external logs, ticket merge/split, unified timeline, full audit trail
- ⏭️ **Next** — Phase 5 auth · Phase 6 search / attachments / notifications / UI polish (rich editor, thread modal, quote-collapse on display)

## Tech stack
- **Next.js 16** (App Router) · **TypeScript**
- **Prisma 7** · **PostgreSQL** (Neon serverless, via the official driver adapter)
- **IMAP** with `imapflow` + `mailparser`
- **Vitest**

## Architecture
Ports & adapters throughout, so the core logic never depends on a concrete service:

| Concern | Port (interface) | Default adapter |
|---|---|---|
| Receive mail | `MailReceiver` | IMAP |
| Send mail | `MailSender` | SMTP (`nodemailer`) |
| Search | `SearchProvider` | PostgreSQL |
| Storage | `StorageProvider` | Local FS / S3-compatible |
| Auth | `AuthProvider` | Internal accounts |

The ingestion core (dedup → thread-link → number → create/append → reopen) is pure logic, unit-tested with fakes — no live IMAP or database required to test it.

## Getting started
```bash
npm install
cp .env.example .env       # set DATABASE_URL (Neon or any Postgres)
npx prisma migrate dev     # apply the schema
npx prisma db seed         # sample data
npm run dev                # http://localhost:3000
```

## Core data model
`Ticket` · `Message` · `Operator` · `MailAccount` · `Contact` · `Label` · `Note` · `Attachment` · `AuditLog` · `Template` · `Settings`

---

<sub>Designed and implemented with [Claude Code](https://claude.com/claude-code).</sub>
