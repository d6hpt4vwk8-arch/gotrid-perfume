import { renderToBuffer } from "@react-pdf/renderer";
import QRCode from "qrcode";
import type { Order } from "@prisma/client";
import { currentSeller, sellerLine } from "@/lib/business-identity";
import { formatPrice } from "@/lib/format";
import { czAccountFromIban } from "@/lib/payments/bank-account";
import { buildSpaydPayload } from "@/lib/payments/qr-platba";
import { htmlToBlocks } from "@/lib/pdf/legal-html";
import { LegalPdfDocument } from "@/lib/pdf/legal-document";
import { OdstoupeniDocument } from "@/lib/pdf/odstoupeni";
import { PaymentSlipDocument } from "@/lib/pdf/payment-slip";
import { SITE_URL } from "@/lib/site";

export type EmailAttachment = { filename: string; content: Buffer };

// Next.js forbids react-dom/server in server code, so instead of rendering the
// legal pages in-process we read the HTML the site itself serves for them —
// one source of truth for the text, and the PDF can never drift from the page.
async function fetchPageBlocks(path: string) {
  const res = await fetch(`${SITE_URL}${path}`, { headers: { "user-agent": "gotrid-order-email-pdf" }, cache: "no-store" });
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  const blocks = htmlToBlocks(await res.text(), "main");
  if (blocks.length < 10) throw new Error(`${path}: page text not found`);
  return blocks;
}

// The legal PDFs only change with a deploy (the pages are static JSX), so one
// render per server instance is enough — every order e-mail reuses the buffers.
let legalCache: EmailAttachment[] | null = null;

async function legalAttachments(): Promise<EmailAttachment[]> {
  if (legalCache) return legalCache;
  const seller = currentSeller();
  const [terms, returns] = await Promise.all([
    fetchPageBlocks("/obchodni-podminky"),
    fetchPageBlocks("/podminky-vraceni-zbozi"),
  ]);
  const [termsPdf, withdrawalPdf] = await Promise.all([
    renderToBuffer(
      <LegalPdfDocument
        title="Obchodní podmínky — Gotrid Perfume"
        sellerLine={sellerLine(seller)}
        sections={[
          { title: "Obchodní podmínky", blocks: terms },
          { title: "Podmínky vrácení zboží", blocks: returns },
        ]}
      />,
    ),
    renderToBuffer(<OdstoupeniDocument />),
  ]);
  legalCache = [
    { filename: "Obchodni-podminky.pdf", content: termsPdf },
    { filename: "Formular-pro-odstoupeni-od-smlouvy.pdf", content: withdrawalPdf },
  ];
  return legalCache;
}

async function paymentSlipAttachment(order: Order): Promise<EmailAttachment | null> {
  const iban = process.env.BANK_IBAN;
  if (order.paymentMethod !== "BANK_TRANSFER" || !iban) return null;
  const qrDataUrl = await QRCode.toDataURL(
    buildSpaydPayload({ iban, amount: Number(order.total), variableSymbol: order.number, message: `Objednavka ${order.number}` }),
    { margin: 1, width: 480 },
  );
  const pdf = await renderToBuffer(
    <PaymentSlipDocument
      orderNumber={order.number}
      account={czAccountFromIban(iban)}
      iban={iban.replace(/\s/g, "")}
      amount={formatPrice(order.total)}
      variableSymbol={order.number.replace(/\D/g, "")}
      qrDataUrl={qrDataUrl}
      sellerName={currentSeller().legalName}
    />,
  );
  return { filename: `Platebni-udaje-${order.number}.pdf`, content: pdf };
}

/**
 * PDFs attached to the customer's order confirmation: terms + return
 * conditions, the withdrawal form, and — for bank-transfer orders — a printable
 * payment slip with the QR code. Never throws: a PDF problem must not cost the
 * customer their confirmation e-mail, so failures are logged and skipped.
 */
export async function buildOrderConfirmationAttachments(order: Order): Promise<EmailAttachment[]> {
  const out: EmailAttachment[] = [];
  const [legal, slip] = await Promise.allSettled([legalAttachments(), paymentSlipAttachment(order)]);
  if (slip.status === "fulfilled" && slip.value) out.push(slip.value);
  else if (slip.status === "rejected") console.error(`[email] payment slip PDF failed for ${order.number}`, slip.reason);
  if (legal.status === "fulfilled") out.push(...legal.value);
  else console.error(`[email] legal PDFs failed for ${order.number}`, legal.reason);
  return out;
}
