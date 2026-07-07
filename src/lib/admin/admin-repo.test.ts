import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { isEncrypted } from "@/lib/crypto/secret";
import { resolveImapConfig, resolveSmtpConfig } from "@/lib/mail/config";
import {
  listOperators,
  listAccounts,
  createOperator,
  updateOperator,
  resetOperatorPassword,
  listLabels,
  createLabel,
  updateLabel,
  deleteLabel,
  listAccountsDetail,
  createAccount,
  updateAccount,
  setAccountCredentials,
} from "./admin-repo";

// 非重複PREFIX(既存 LKUP/MGCND/NUMT/OP/MS/AUTH/SESS/TLST/SX*/ADMOP と前方一致しない)。
const PREFIX = "ADMOP";
let accountAId = "";
let accountBId = "";

beforeAll(async () => {
  const accA = await prisma.mailAccount.create({ data: { name: `${PREFIX}窓口A`, casePrefix: `${PREFIX}A`, config: {} } });
  const accB = await prisma.mailAccount.create({ data: { name: `${PREFIX}窓口B`, casePrefix: `${PREFIX}B`, config: {} } });
  accountAId = accA.id;
  accountBId = accB.id;
});

afterAll(async () => {
  await prisma.operator.deleteMany({ where: { username: { contains: PREFIX } } });
  await prisma.mailAccount.deleteMany({ where: { casePrefix: { startsWith: PREFIX } } });
  await prisma.label.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.$disconnect();
});

describe("createOperator / listOperators", () => {
  it("作成→一覧に現れ、パスワードはハッシュ化され、窓口が connect される", async () => {
    const res = await createOperator({
      username: `${PREFIX}-taro`,
      displayName: `${PREFIX}太郎`,
      password: "password1",
      role: "MEMBER",
      accountIds: [accountAId],
    });
    expect(res.kind).toBe("ok");

    const ops = await listOperators();
    const mine = ops.find((o) => o.username === `${PREFIX}-taro`);
    expect(mine).toBeDefined();
    expect(mine!.role).toBe("MEMBER");
    expect(mine!.isActive).toBe(true);
    expect(mine!.accounts.map((a) => a.id)).toEqual([accountAId]);

    // パスワードは平文で保存されていない(ハッシュで検証できる)。
    const raw = await prisma.operator.findUnique({ where: { id: mine!.id }, select: { passwordHash: true } });
    expect(raw!.passwordHash).not.toBe("password1");
    expect(await verifyPassword("password1", raw!.passwordHash)).toBe(true);
  });

  it("username 重複は invalid", async () => {
    await createOperator({ username: `${PREFIX}-dup`, displayName: "D", password: "password1", role: "MEMBER" });
    const again = await createOperator({ username: `${PREFIX}-dup`, displayName: "D2", password: "password1", role: "MEMBER" });
    expect(again.kind).toBe("invalid");
  });

  it("入力不正(短いパスワード)は invalid で作成されない", async () => {
    const res = await createOperator({ username: `${PREFIX}-bad`, displayName: "B", password: "short", role: "MEMBER" });
    expect(res.kind).toBe("invalid");
    const found = await prisma.operator.findUnique({ where: { username: `${PREFIX}-bad` } });
    expect(found).toBeNull();
  });
});

describe("updateOperator", () => {
  it("role/isActive/割当窓口(置換)を更新する", async () => {
    const created = await createOperator({ username: `${PREFIX}-upd`, displayName: "U", password: "password1", role: "MEMBER", accountIds: [accountAId] });
    const id = (created as { kind: "ok"; value: { id: string } }).value.id;

    const res = await updateOperator(id, { role: "DISPATCHER", isActive: false, accountIds: [accountBId] });
    expect(res.kind).toBe("ok");

    const ops = await listOperators();
    const mine = ops.find((o) => o.id === id)!;
    expect(mine.role).toBe("DISPATCHER");
    expect(mine.isActive).toBe(false);
    expect(mine.accounts.map((a) => a.id)).toEqual([accountBId]);
  });

  it("存在しない id は not_found", async () => {
    const res = await updateOperator("nonexistent-admop-id", { isActive: false });
    expect(res.kind).toBe("not_found");
  });

  it("不正な role は invalid", async () => {
    const created = await createOperator({ username: `${PREFIX}-role`, displayName: "R", password: "password1", role: "MEMBER" });
    const id = (created as { kind: "ok"; value: { id: string } }).value.id;
    const res = await updateOperator(id, { role: "GOD" });
    expect(res.kind).toBe("invalid");
  });
});

describe("resetOperatorPassword", () => {
  it("新パスワードで検証でき、旧パスワードは失効する", async () => {
    const created = await createOperator({ username: `${PREFIX}-pw`, displayName: "P", password: "oldpass12", role: "MEMBER" });
    const id = (created as { kind: "ok"; value: { id: string } }).value.id;

    const res = await resetOperatorPassword(id, "newpass34");
    expect(res.kind).toBe("ok");

    const raw = await prisma.operator.findUnique({ where: { id }, select: { passwordHash: true } });
    expect(await verifyPassword("newpass34", raw!.passwordHash)).toBe(true);
    expect(await verifyPassword("oldpass12", raw!.passwordHash)).toBe(false);
  });

  it("短いパスワードは invalid", async () => {
    const created = await createOperator({ username: `${PREFIX}-pw2`, displayName: "P2", password: "oldpass12", role: "MEMBER" });
    const id = (created as { kind: "ok"; value: { id: string } }).value.id;
    const res = await resetOperatorPassword(id, "short");
    expect(res.kind).toBe("invalid");
  });
});

describe("listAccounts", () => {
  it("作成済みの窓口を含む", async () => {
    const accs = await listAccounts();
    const prefixes = accs.map((a) => a.casePrefix);
    expect(prefixes).toContain(`${PREFIX}A`);
    expect(prefixes).toContain(`${PREFIX}B`);
  });
});

describe("ラベルCRUD", () => {
  it("作成→一覧に現れ、色が正規化される", async () => {
    const res = await createLabel({ name: `${PREFIX}-緊急`, color: "#ff0000" });
    expect(res.kind).toBe("ok");
    const empty = await createLabel({ name: `${PREFIX}-通常`, color: "" });
    expect(empty.kind).toBe("ok");

    const labels = await listLabels();
    const urgent = labels.find((l) => l.name === `${PREFIX}-緊急`);
    const normal = labels.find((l) => l.name === `${PREFIX}-通常`);
    expect(urgent!.color).toBe("#ff0000");
    expect(normal!.color).toBe(""); // null → "" 正規化
  });

  it("名前が空なら invalid で作成されない", async () => {
    const res = await createLabel({ name: "   " });
    expect(res.kind).toBe("invalid");
  });

  it("更新(改名・改色)できる", async () => {
    const created = await createLabel({ name: `${PREFIX}-old`, color: "#111111" });
    const id = (created as { kind: "ok"; value: { id: string } }).value.id;
    const res = await updateLabel(id, { name: `${PREFIX}-new`, color: "#222222" });
    expect(res.kind).toBe("ok");
    const labels = await listLabels();
    const mine = labels.find((l) => l.id === id)!;
    expect(mine.name).toBe(`${PREFIX}-new`);
    expect(mine.color).toBe("#222222");
  });

  it("削除できる。存在しない id は not_found", async () => {
    const created = await createLabel({ name: `${PREFIX}-del` });
    const id = (created as { kind: "ok"; value: { id: string } }).value.id;
    expect((await deleteLabel(id)).kind).toBe("ok");
    const labels = await listLabels();
    expect(labels.find((l) => l.id === id)).toBeUndefined();
    expect((await deleteLabel("nonexistent-admop-label")).kind).toBe("not_found");
  });
});

describe("窓口(MailAccount)管理", () => {
  it("作成→詳細一覧に現れ、ticket/operator数0・空 config で登録される", async () => {
    const res = await createAccount({ name: `${PREFIX}新窓口`, casePrefix: `${PREFIX}C`, signature: "敬具" });
    expect(res.kind).toBe("ok");
    const id = (res as { kind: "ok"; value: { id: string } }).value.id;

    const accs = await listAccountsDetail();
    const mine = accs.find((a) => a.id === id)!;
    expect(mine.name).toBe(`${PREFIX}新窓口`);
    expect(mine.casePrefix).toBe(`${PREFIX}C`);
    expect(mine.signature).toBe("敬具");
    expect(mine.ticketCount).toBe(0);
    expect(mine.operatorCount).toBe(0);

    const raw = await prisma.mailAccount.findUnique({ where: { id }, select: { config: true } });
    expect(raw!.config).toEqual({});
  });

  it("casePrefix 重複は invalid(beforeAll の ADMOPA と衝突)", async () => {
    const res = await createAccount({ name: "dup", casePrefix: `${PREFIX}A` });
    expect(res.kind).toBe("invalid");
  });

  it("接頭辞に空白/記号は invalid", async () => {
    expect((await createAccount({ name: "x", casePrefix: `${PREFIX} X` })).kind).toBe("invalid");
  });

  it("name/signature を更新でき、casePrefix は不変", async () => {
    const created = await createAccount({ name: `${PREFIX}upd`, casePrefix: `${PREFIX}U` });
    const id = (created as { kind: "ok"; value: { id: string } }).value.id;

    const res = await updateAccount(id, { name: `${PREFIX}renamed`, signature: "" });
    expect(res.kind).toBe("ok");

    const accs = await listAccountsDetail();
    const mine = accs.find((a) => a.id === id)!;
    expect(mine.name).toBe(`${PREFIX}renamed`);
    expect(mine.signature).toBe(""); // "" → null → 表示は ""
    expect(mine.casePrefix).toBe(`${PREFIX}U`); // 不変
  });

  it("存在しない id の更新は not_found", async () => {
    expect((await updateAccount("nonexistent-admop-acc", { name: "x" })).kind).toBe("not_found");
  });
});

describe("setAccountCredentials(認証情報の暗号化保存)", () => {
  it("IMAP/SMTPのpassを暗号化して保存し、復号で元に戻る", async () => {
    const created = await createAccount({ name: `${PREFIX}cred`, casePrefix: `${PREFIX}CR` });
    const id = (created as { kind: "ok"; value: { id: string } }).value.id;

    const res = await setAccountCredentials(id, {
      imap: { host: "imap.example.com", port: 993, secure: true, user: "iuser", pass: "imap-plain", mailbox: "INBOX" },
      smtp: { host: "smtp.example.com", port: 587, secure: false, user: "suser", pass: "smtp-plain" },
    });
    expect(res.kind).toBe("ok");

    // DB上のpassは平文ではなく暗号化されている。
    const raw = await prisma.mailAccount.findUnique({ where: { id }, select: { config: true } });
    const config = raw!.config as { pass: string; smtp: { pass: string } };
    expect(config.pass).not.toBe("imap-plain");
    expect(isEncrypted(config.pass)).toBe(true);
    expect(isEncrypted(config.smtp.pass)).toBe(true);

    // 読み取りヘルパで復号すると元のパスワードに戻る。
    const imap = resolveImapConfig(config);
    const smtp = resolveSmtpConfig(config);
    expect(imap!.pass).toBe("imap-plain");
    expect(imap!.host).toBe("imap.example.com");
    expect(smtp!.pass).toBe("smtp-plain");
  });

  it("imap/smtp どちらも無ければ invalid", async () => {
    const created = await createAccount({ name: `${PREFIX}cred2`, casePrefix: `${PREFIX}C2` });
    const id = (created as { kind: "ok"; value: { id: string } }).value.id;
    expect((await setAccountCredentials(id, {})).kind).toBe("invalid");
  });

  it("存在しない id は not_found", async () => {
    const res = await setAccountCredentials("nonexistent-admop-cred", { smtp: { host: "h", port: 25, secure: false, user: "u", pass: "p" } });
    expect(res.kind).toBe("not_found");
  });
});
