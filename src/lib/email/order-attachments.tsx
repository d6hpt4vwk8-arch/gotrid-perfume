import { renderToBuffer } from "@react-pdf/renderer";
import type { Order } from "@prisma/client";
import { currentSeller, sellerLine } from "@/lib/business-identity";
import { bankQrDataUrl, getBankPayment } from "@/lib/payments/bank-details";
import { htmlToBlocks } from "@/lib/pdf/legal-html";
import { LegalPdfDocument } from "@/lib/pdf/legal-document";
import { OdstoupeniDocument } from "@/lib/pdf/odstoupeni";
import { PaymentSlipDocument } from "@/lib/pdf/payment-slip";
import { getMailContext, orderMailLocale, type MailContext, type MailLocale } from "@/lib/email/locale";

export type EmailAttachment = { filename: string; content: Buffer };

// Next.js forbids react-dom/server in server code, so instead of rendering the
// legal pages in-process we read the HTML the site itself serves for them —
// one source of truth for the text, and the PDF can never drift from the page.
// Slovak orders read the /sk pages, so they get the Slovak terms.
async function fetchPageBlocks(ctx: MailContext, path: string) {
  const url = ctx.url(path);
  const res = await fetch(url, { headers: { "user-agent": "gotrid-order-email-pdf" }, cache: "no-store" });
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  const blocks = htmlToBlocks(await res.text(), "main");
  if (blocks.length < 10) throw new Error(`${url}: page text not found`);
  return blocks;
}

// The legal PDFs only change with a deploy (the pages are static JSX), so one
// render per language per server instance is enough — every order e-mail
// reuses the buffers.
const legalCache = new Map<MailLocale, EmailAttachment[]>();

async function legalAttachments(ctx: MailContext): Promise<EmailAttachment[]> {
  const cached = legalCache.get(ctx.locale);
  if (cached) return cached;
  const { tr } = ctx;
  const seller = currentSeller();
  const [terms, returns] = await Promise.all([
    fetchPageBlocks(ctx, "/obchodni-podminky"),
    fetchPageBlocks(ctx, "/podminky-vraceni-zbozi"),
  ]);
  const [termsPdf, withdrawalPdf] = await Promise.all([
    renderToBuffer(
      <LegalPdfDocument
        title={`${tr("Obchodní podmínky")} — Gotrid Perfume`}
        sellerLine={sellerLine(seller)}
        sections={[
          { title: tr("Obchodní podmínky"), blocks: terms },
          { title: tr("Podmínky vrácení zboží"), blocks: returns },
        ]}
      />,
    ),
    renderToBuffer(<OdstoupeniDocument tr={tr} />),
  ]);
  const sk = ctx.locale === "sk";
  const out = [
    { filename: sk ? "Obchodne-podmienky.pdf" : "Obchodni-podminky.pdf", content: termsPdf },
    {
      filename: sk ? "Formular-na-odstupenie-od-zmluvy.pdf" : "Formular-pro-odstoupeni-od-smlouvy.pdf",
      content: withdrawalPdf,
    },
  ];
  legalCache.set(ctx.locale, out);
  return out;
}

async function paymentSlipAttachment(order: Order, ctx: MailContext): Promise<EmailAttachment | null> {
  const bank = getBankPayment(order);
  if (!bank) return null;
  const pdf = await renderToBuffer(
    <PaymentSlipDocument
      orderNumber={order.number}
      account={bank.account}
      iban={bank.iban}
      bic={bank.bic}
      amount={bank.amountLabel}
      variableSymbol={bank.variableSymbol}
      qrDataUrl={await bankQrDataUrl(bank, 480)}
      sellerName={bank.beneficiary}
      tr={ctx.tr}
    />,
  );
  return { filename: `${ctx.locale === "sk" ? "Platobne-udaje" : "Platebni-udaje"}-${order.number}.pdf`, content: pdf };
}

/**
 * PDFs attached to the customer's order confirmation: terms + return
 * conditions, the withdrawal form, and — for bank-transfer orders — a printable
 * payment slip with the QR code. Czech orders get Czech documents and the CZK
 * account; Slovak orders get Slovak documents and the EUR account. Never
 * throws: a PDF problem must not cost the customer their confirmation e-mail,
 * so failures are logged and skipped.
 */
export async function buildOrderConfirmationAttachments(order: Order): Promise<EmailAttachment[]> {
  const ctx = await getMailContext(orderMailLocale(order));
  const out: EmailAttachment[] = [];
  const [legal, slip] = await Promise.allSettled([legalAttachments(ctx), paymentSlipAttachment(order, ctx)]);
  if (slip.status === "fulfilled" && slip.value) out.push(slip.value);
  else if (slip.status === "rejected") console.error(`[email] payment slip PDF failed for ${order.number}`, slip.reason);
  if (legal.status === "fulfilled") out.push(...legal.value);
  else console.error(`[email] legal PDFs failed for ${order.number}`, legal.reason);
  return out;
}
