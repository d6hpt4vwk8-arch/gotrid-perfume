import { Resend } from "resend";

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

let client: Resend | null = null;

// Where customers' replies to the automatic mails land (a real mailbox, unlike the sender address below).
export const EMAIL_REPLY_TO = process.env.RESEND_REPLY_TO ?? "info@gotridperfume.cz";

export function getResendClient(): Resend {
  if (!process.env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY není nastaven — e-maily se neodesílají.");
  }
  if (!client) {
    const created = new Resend(process.env.RESEND_API_KEY);
    // Our automatic mails go out from objednavky@, which is not a mailbox (only info@ exists), so a customer's
    // "Reply" would bounce or vanish. Default every message's Reply-To to the real inbox; a caller can still set its own.
    const send = created.emails.send.bind(created.emails) as unknown as (payload: Record<string, unknown>, options?: unknown) => unknown;
    (created.emails as unknown as { send: typeof send }).send = (payload, options) =>
      send({ replyTo: EMAIL_REPLY_TO, ...payload }, options);
    client = created;
  }
  return client;
}

export const EMAIL_FROM = process.env.RESEND_FROM_EMAIL ?? "Gotrid Perfume <objednavky@gotridperfume.cz>";
export { OWNER_EMAIL } from "@/lib/business-identity";
