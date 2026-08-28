import { SITE_URL } from "@/lib/site";
import { formatPrice } from "@/lib/format";
import type { CartItem } from "@/lib/cart-context";
import { EMAIL_FROM, getResendClient, isEmailConfigured } from "./resend";

function cartItemsHtml(items: CartItem[]): string {
  const rows = items
    .map(
      (item) => `
        <tr>
          <td style="padding:8px">
            ${item.image ? `<img src="${SITE_URL}${item.image}" alt="" width="60" style="display:block">` : ""}
          </td>
          <td style="padding:8px">
            <a href="${SITE_URL}/produkt/${item.slug}" style="color:#111">${item.name}</a>
          </td>
          <td style="padding:8px">${item.qty}×</td>
          <td style="padding:8px">${formatPrice(item.price)}</td>
        </tr>`,
    )
    .join("");
  return `<table cellpadding="0" cellspacing="0" style="width:100%;margin:16px 0">${rows}</table>`;
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
    html: `
      <h1>Ahoj${params.firstName ? ` ${params.firstName}` : ""}!</h1>
      <p>Všimli jsme si, že jste u nás nedokončili objednávku — nezapomněli jste na ni?</p>
      ${cartItemsHtml(params.cartSnapshot)}
      <p><a href="${SITE_URL}/kosik">Dokončit objednávku</a></p>
    `,
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
}
