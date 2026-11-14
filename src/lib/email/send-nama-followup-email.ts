import { SITE_URL } from "@/lib/site";
import { emailBenefits, emailButton, renderEmailLayout } from "./layout";
import { getMailContext, type MailLocale } from "./locale";
import { EMAIL_FROM, getResendClient, isEmailConfigured } from "./resend";

const escapeHtml = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// Czech and Slovak copy kept inline (two short variants) instead of growing the shared translation table.
const COPY = {
  cs: {
    subject: "Jak se vám líbí Nama Fiji? Sleva 10 % na celou značku",
    hello: "Ahoj",
    bannerSub: "na celou značku, 14 dní",
    intro: "Před nějakou dobou jste k objednávce dostali náš dárkový Discovery Box Nama Fiji — šest vzorků pleťové péče s mořskými hrozny z Fidži. Doufáme, že jste si je vyzkoušeli.",
    offer: "Pokud vám přišly k chuti, máme pro vás osobní kód:",
    discount: "sleva",
    note: (percent: number, date: string, email: string) =>
      `−${percent} % na všechny produkty Nama Fiji, platí do ${date}, jednou, při objednávce na tento e-mail (${email}). Stačí ho zadat v košíku. Na ostatní zboží v košíku se sleva nevztahuje.`,
    button: "Zobrazit Nama Fiji",
    footer: "Tento e-mail vám zasíláme jako zákazníkovi, který u nás dostal dárek k objednávce, s nabídkou obdobného zboží (§7 odst. 3 zákona č. 480/2004 Sb.).",
    unsub: "Odhlásit se z těchto e-mailů",
  },
  sk: {
    subject: "Ako sa vám páči Nama Fiji? Zľava 10 % na celú značku",
    hello: "Ahoj",
    bannerSub: "na celú značku, 14 dní",
    intro: "Pred nejakým časom ste k objednávke dostali náš darčekový Discovery Box Nama Fiji — šesť vzoriek pleťovej starostlivosti s morskými hroznami z Fidži. Dúfame, že ste si ich vyskúšali.",
    offer: "Ak vám prišli k chuti, máme pre vás osobný kód:",
    discount: "zľava",
    note: (percent: number, date: string, email: string) =>
      `−${percent} % na všetky produkty Nama Fiji, platí do ${date}, raz, pri objednávke na tento e-mail (${email}). Stačí ho zadať v košíku. Na ostatný tovar v košíku sa zľava nevzťahuje.`,
    button: "Zobraziť Nama Fiji",
    footer: "Tento e-mail vám zasielame ako zákazníkovi, ktorý u nás dostal darček k objednávke, s ponukou obdobného tovaru.",
    unsub: "Odhlásiť sa z týchto e-mailov",
  },
} as const;

export interface NamaFollowupParams {
  email: string;
  firstName: string;
  locale: MailLocale;
  code: string;
  percent: number;
  expiresAt: Date;
  unsubscribeUrl: string;
  /** Passed by scripts running outside Next (the settings cache only works inside it). */
  settings?: { freeShippingThreshold: number; czkToEurRate: number };
}

export async function renderNamaFollowupHtml(p: NamaFollowupParams): Promise<string> {
  const ctx = await getMailContext(p.locale);
  const t = COPY[p.locale === "sk" ? "sk" : "cs"];
  const benefits = await emailBenefits(ctx, p.settings);
  const date = p.expiresAt.toLocaleDateString(p.locale === "sk" ? "sk-SK" : "cs-CZ");
  // Gemini-made banner (public/email/nama-fiji-banner.jpg): the text sits on the left, over the empty half of the picture.
  // Outlook desktop ignores CSS background images and shows the beige fallback colour with the same text.
  const banner = `
      <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 24px;border-radius:6px;overflow:hidden;">
        <tr>
          <td background="${SITE_URL}/email/nama-fiji-banner.jpg" bgcolor="#efe1cb" style="background:#efe1cb url('${SITE_URL}/email/nama-fiji-banner.jpg') right center / cover no-repeat;border-radius:6px;padding:30px 44% 30px 22px;">
            <div style="font-size:12px;letter-spacing:3px;text-transform:uppercase;color:#6b5a43;font-weight:700;">Nama Fiji</div>
            <div style="font-size:38px;line-height:1.05;font-weight:700;color:#131110;margin:6px 0 4px;white-space:nowrap;">−${p.percent} %</div>
            <div style="font-size:12px;line-height:1.35;color:#4a4033;">${t.bannerSub}</div>
          </td>
        </tr>
      </table>`;
  const inner = `
      ${banner}
      <h1>${t.hello}${p.firstName ? ` ${escapeHtml(p.firstName)}` : ""}!</h1>
      <p>${t.intro}</p>
      <p>${t.offer}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px;">
        <tr>
          <td style="border:1px dashed #8a857e;border-radius:4px;padding:12px 20px;">
            <span style="font-size:13px;font-weight:700;color:#4b6b4f;">−${p.percent} % · ${t.discount} Nama Fiji</span>
            <div style="font-size:20px;font-weight:700;letter-spacing:1px;margin-top:4px;">${p.code}</div>
          </td>
        </tr>
      </table>
      <p style="font-size:13px;color:#8a857e;margin:0 0 20px;">${t.note(p.percent, date, p.email)}</p>
      ${emailButton(ctx.url("/znacka/nama-fiji"), t.button, { large: true })}
      ${benefits}
    `;
  return renderEmailLayout(inner, {
    preheader: `−${p.percent} % na Nama Fiji do ${date}`,
    footerNote: `${t.footer} <a href="${p.unsubscribeUrl}" style="color:#8a857e">${t.unsub}</a>.`,
    ctx,
  });
}

export async function sendNamaFollowupEmail(p: NamaFollowupParams): Promise<void> {
  if (!isEmailConfigured()) throw new Error("RESEND_API_KEY není nastaven.");
  const t = COPY[p.locale === "sk" ? "sk" : "cs"];
  const { error } = await getResendClient().emails.send({
    from: EMAIL_FROM,
    to: p.email,
    subject: t.subject,
    html: await renderNamaFollowupHtml(p),
    headers: { "List-Unsubscribe": `<${p.unsubscribeUrl}>` },
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
}
