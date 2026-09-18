import { SITE_URL } from "@/lib/site";
import { formatPrice } from "@/lib/format";
import type { CartItem } from "@/lib/cart-context";
import { emailButton, renderEmailLayout } from "./layout";
import { EMAIL_FROM, getResendClient, isEmailConfigured } from "./resend";

function cartItemsHtml(items: CartItem[]): string {
  const rows = items
    .map(
      (item) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #e2e0dc">
            ${item.image ? `<img src="${SITE_URL}${item.image}" alt="" width="60" style="display:block;border-radius:4px">` : ""}
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e0dc">
            <a href="${SITE_URL}/produkt/${item.slug}" style="color:#131110;text-decoration:none;font-size:14px">${item.name}</a>
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #e2e0dc;font-size:14px;color:#8a857e">${item.qty}×</td>
          <td style="padding:10px 0;border-bottom:1px solid #e2e0dc;font-size:14px;font-weight:600;text-align:right">${formatPrice(item.price)}</td>
        </tr>`,
    )
    .join("");
  return `<table cellpadding="0" cellspacing="0" style="width:100%;margin:8px 0 24px">${rows}</table>`;
}

export function renderAbandonedCheckoutEmailHtml(params: { firstName: string; cartSnapshot: CartItem[] }): string {
  const inner = `
      <h1>Ahoj${params.firstName ? ` ${params.firstName}` : ""}!</h1>
      <p>Všimli jsme si, že jste u nás nedokončili objednávku — nezapomněli jste na ni? Vaše vybrané položky na vás stále čekají v košíku.</p>
      ${cartItemsHtml(params.cartSnapshot)}
      ${emailButton(`${SITE_URL}/kosik`, "Dokončit objednávku")}
    `;
  return renderEmailLayout(inner, { preheader: "Vaše položky na vás stále čekají v košíku." });
}

export async function sendAbandonedCheckoutEmail(params: {
  email: string;
  firstName: string;
  cartSnapshot: CartItem[];
}): Promise<void> {
  if (!isEmailConfigured()) {
    console.warn(`[email] Resend not configured — skipping abandoned-checkout email for ${params.email}`);
    return;
  }

  const resend = getResendClient();
  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: params.email,
    subject: "Nezapomněli jste na objednávku? — Gotrid Perfume",
    html: renderAbandonedCheckoutEmailHtml(params),
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
}
