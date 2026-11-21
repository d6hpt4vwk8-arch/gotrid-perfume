import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { dkimVerify } from "mailauth";
import { prisma } from "@/lib/prisma";
import { logAdminActivity } from "@/lib/admin/activity-log";
import { EMAIL_FROM, OWNER_EMAIL, getResendClient, isEmailConfigured } from "@/lib/email/resend";
import { parseAirBankNotification } from "@/lib/payments/airbank-email";
import { paymentToken, processBankPayment } from "@/lib/orders/confirm-bank-payment";

/**
 * Reads Air Bank's balance-change notifications from the dedicated banka@ mailbox (IMAP, read-only) and confirms the
 * matching BANK_TRANSFER orders, so the owner no longer has to compare the bank with the admin by hand.
 *
 * A payment mail is trusted only when it is from info@airbank.cz AND its DKIM signature for airbank.cz verifies here
 * (checked against the raw message with Air Bank's DNS key — not the receiving server's own header, which a forger could
 * imitate). Anything else is logged and ignored. Messages are never deleted or flagged: each one is recorded in the
 * activity log under its Message-ID, so re-reading the same mail (or the owner opening it in webmail) is harmless.
 *
 * Env: BANK_IMAP_HOST (default imap.zoner.com), BANK_IMAP_PORT (default 993), BANK_IMAP_USER, BANK_IMAP_PASSWORD.
 */

const LOOKBACK_DAYS = 7;
const MAX_MESSAGES_PER_RUN = 200;
const AIRBANK_SENDER = "info@airbank.cz";
const AIRBANK_DKIM_DOMAIN = "airbank.cz";

export interface BankSyncResult {
  configured: boolean;
  scanned: number;
  newMessages: number;
  confirmed: number;
  alreadyPaid: number;
  flagged: number;
  rejected: number;
  errors: number;
}

const emptyResult = (configured: boolean): BankSyncResult => ({
  configured,
  scanned: 0,
  newMessages: 0,
  confirmed: 0,
  alreadyPaid: 0,
  flagged: 0,
  rejected: 0,
  errors: 0,
});

const msgToken = (id: string) => `[msg:${id}]`;

async function notifyOwner(subject: string, html: string): Promise<void> {
  if (!isEmailConfigured()) return;
  try {
    await getResendClient().emails.send({ from: EMAIL_FROM, to: OWNER_EMAIL, subject, html });
  } catch (err) {
    console.error("[bank-sync] failed to send owner alert", err);
  }
}

/** True when the raw message carries a valid DKIM signature from Air Bank's own domain. */
export async function isAuthenticAirBankMail(source: Buffer): Promise<boolean> {
  try {
    const result = await dkimVerify(source);
    return result.results.some(
      (r) => r.status?.result === "pass" && (r.signingDomain ?? "").toLowerCase() === AIRBANK_DKIM_DOMAIN,
    );
  } catch (err) {
    console.error("[bank-sync] DKIM verification failed to run", err);
    return false;
  }
}

export async function syncBankPayments(): Promise<BankSyncResult> {
  const user = process.env.BANK_IMAP_USER;
  const pass = process.env.BANK_IMAP_PASSWORD;
  if (!user || !pass) return emptyResult(false);

  const result = emptyResult(true);
  const client = new ImapFlow({
    host: process.env.BANK_IMAP_HOST || "imap.zoner.com",
    port: Number(process.env.BANK_IMAP_PORT || 993),
    secure: true,
    auth: { user, pass },
    logger: false,
  });

  try {
    await client.connect();
  } catch (err) {
    console.error("[bank-sync] IMAP connect/login failed", err);
    result.errors++;
    return result;
  }

  const lock = await client.getMailboxLock("INBOX");
  try {
    const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 3600 * 1000);
    const found = await client.search({ since }, { uid: true });
    const uids = (found || []).slice(-MAX_MESSAGES_PER_RUN);
    result.scanned = uids.length;

    // Cheap pass first: envelope only, so mails that were handled on an earlier run are never downloaded again.
    const pending: { uid: number; messageId: string }[] = [];
    if (uids.length > 0) {
      for await (const msg of client.fetch(uids, { uid: true, envelope: true }, { uid: true })) {
        const messageId = msg.envelope?.messageId;
        if (!messageId) continue;
        const done = await prisma.adminActivityLog.findFirst({
          where: { detail: { contains: msgToken(messageId) } },
          select: { id: true },
        });
        if (!done) pending.push({ uid: msg.uid, messageId });
      }
    }
    result.newMessages = pending.length;

    for (const { uid, messageId } of pending) {
      try {
        const msg = await client.fetchOne(String(uid), { uid: true, source: true }, { uid: true });
        if (!msg || !msg.source) continue;
        const parsed = await simpleParser(msg.source);
        const from = (parsed.from?.value?.[0]?.address ?? "").toLowerCase();
        const subject = parsed.subject ?? "";

        if (from !== AIRBANK_SENDER) {
          // Not from the bank at all (spam, the owner testing, a forwarded mail): remember it and move on quietly.
          await logAdminActivity({ action: "bank_email.ignored", entityType: "BankMail", detail: `${from || "?"}: ${subject.slice(0, 80)} ${msgToken(messageId)}` });
          continue;
        }

        if (!(await isAuthenticAirBankMail(msg.source))) {
          result.rejected++;
          await logAdminActivity({ action: "bank_email.rejected", entityType: "BankMail", detail: `Podpis DKIM se nepodařilo ověřit: ${subject.slice(0, 80)} ${msgToken(messageId)}` });
          await notifyOwner(
            "Banka: podezřelý e-mail tváří se jako Air Bank",
            `<p>Do schránky banka@ přišel e-mail s odesílatelem ${AIRBANK_SENDER}, ale jeho podpis DKIM se nepodařilo ověřit, proto jsem ho <strong>nezpracoval</strong>.</p><p>Předmět: ${subject.replace(/[<>]/g, "")}</p><p>Pokud jde o skutečné oznámení, zkontrolujte platbu ručně v internetovém bankovnictví.</p>`,
          );
          continue;
        }

        const payment = parseAirBankNotification(parsed.text ?? "");
        if (!payment) {
          await logAdminActivity({ action: "bank_email.ignored", entityType: "BankMail", detail: `Air Bank (jiná zpráva): ${subject.slice(0, 80)} ${msgToken(messageId)}` });
          continue;
        }

        // The same payment can arrive twice (e.g. the notification address is set on both info@ and banka@ and one is forwarded).
        if (payment.transactionCode) {
          const dup = await prisma.adminActivityLog.findFirst({
            where: { detail: { contains: paymentToken(payment.transactionCode) } },
            select: { id: true },
          });
          if (dup) {
            await logAdminActivity({ action: "bank_email.ignored", entityType: "BankMail", detail: `Duplicitní oznámení transakce ${payment.transactionCode} ${msgToken(messageId)}` });
            continue;
          }
        }

        const outcome = await processBankPayment(payment);
        if (outcome.outcome === "confirmed") result.confirmed++;
        else if (outcome.outcome === "seen-already-paid") result.alreadyPaid++;
        else if (outcome.outcome === "flagged") result.flagged++;

        await logAdminActivity({
          action: "bank_email.processed",
          entityType: "BankMail",
          detail: `${outcome.outcome}: ${outcome.detail} ${payment.transactionCode ? paymentToken(payment.transactionCode) + " " : ""}${msgToken(messageId)}`,
        });
      } catch (err) {
        // Left unrecorded on purpose: the next run retries this message.
        result.errors++;
        console.error(`[bank-sync] failed to process message ${messageId}`, err);
      }
    }
  } finally {
    lock.release();
    await client.logout().catch(() => undefined);
  }

  return result;
}
