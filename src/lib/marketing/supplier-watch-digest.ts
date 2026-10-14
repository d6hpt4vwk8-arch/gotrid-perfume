import { loadSupplierWatch } from "@/lib/admin/supplier-watch";
import { logAdminActivity } from "@/lib/admin/activity-log";
import { EMAIL_FROM, OWNER_EMAIL, getResendClient, isEmailConfigured } from "@/lib/email/resend";

const MAX_ROWS = 25;

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Daily note to the owner: goods we actually sell whose supplier stock is
 * draining (≥ 20 % in 7 days), nearly gone (≤ 10 left) or whose wholesale price
 * jumped (≥ 5 %). Silent when nothing qualifies. Same data as /admin/sledovani-spv
 * — the point is a nudge to buy a few units ahead of a supplier stockout.
 */
export async function sendSupplierWatchDigest(): Promise<{ sent: boolean; flagged: number }> {
  const { rows } = await loadSupplierWatch();
  const flagged = rows.filter((r) => r.sold30 > 0 && (r.falling || r.low || r.costUp));
  if (flagged.length === 0 || !isEmailConfigured()) return { sent: false, flagged: flagged.length };

  const shown = flagged.slice(0, MAX_ROWS);
  const tr = shown
    .map((r) => {
      const flags = [r.falling && "sklad klesá", r.low && "dochází", r.costUp && "cena ↑"].filter(Boolean).join(", ");
      const trend = r.s7 !== null ? ` (před 7 dny ${r.s7})` : "";
      const cost = `${Math.round(r.cost)} Kč${r.costChange !== null && Math.abs(r.costChange) >= 1 ? ` (${r.costChange > 0 ? "+" : ""}${Math.round(r.costChange)})` : ""}`;
      return `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #eee">${esc(r.product.name)}<br><span style="color:#888;font-size:12px">${esc(r.product.code)}</span></td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee">${r.sold30}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee">${r.supplierNow} ks${trend}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee">${cost}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #eee">${flags}</td>
      </tr>`;
    })
    .join("");

  const resend = getResendClient();
  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: OWNER_EMAIL,
    subject: `Dodavatelé — ${flagged.length} produktů, které prodáváme, ubývá nebo zdražuje`,
    html: `
      <p>Zboží, které prodáváme a u kterého se mění stav nebo cena u dodavatele:</p>
      <table style="border-collapse:collapse;font-size:14px">
        <tr style="text-align:left;color:#666"><th style="padding:6px 8px">Produkt</th><th style="padding:6px 8px">Prodáno 30 d</th><th style="padding:6px 8px">Sklad dodavatele</th><th style="padding:6px 8px">Nákup bez DPH</th><th style="padding:6px 8px">Poznámka</th></tr>
        ${tr}
      </table>
      ${flagged.length > shown.length ? `<p>…a dalších ${flagged.length - shown.length} v administraci.</p>` : ""}
      <p><a href="https://www.gotridperfume.cz/admin/sledovani-spv">Otevřít Sledování dodavatelů</a></p>
    `,
  });
  if (error) throw new Error(`Resend error: ${error.message}`);

  await logAdminActivity({
    action: "supplier_watch_digest",
    entityType: "Product",
    detail: `Supplier watch digest sent: ${flagged.length} flagged (${shown
      .slice(0, 5)
      .map((r) => r.product.code)
      .join(", ")}${flagged.length > 5 ? ", …" : ""})`,
  });
  return { sent: true, flagged: flagged.length };
}
