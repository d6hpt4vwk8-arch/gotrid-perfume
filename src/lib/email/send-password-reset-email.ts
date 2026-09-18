import { SITE_URL } from "@/lib/site";
import { emailButton, renderEmailLayout } from "./layout";
import { EMAIL_FROM, getResendClient, isEmailConfigured } from "./resend";

export function renderPasswordResetEmailHtml(resetUrl: string): string {
  const inner = `
      <h1>Ahoj!</h1>
      <p>Požádali jste o obnovení hesla k účtu na Gotrid Perfume. Odkaz je platný 1 hodinu.</p>
      ${emailButton(resetUrl, "Nastavit nové heslo")}
      <p>Pokud jste o obnovení hesla nežádali, tento e-mail můžete ignorovat.</p>
    `;
  return renderEmailLayout(inner, { preheader: "Odkaz pro nastavení nového hesla je platný 1 hodinu." });
}

export async function sendPasswordResetEmail(email: string, token: string) {
  if (!isEmailConfigured()) {
    console.warn(`[email] Resend not configured — skipping password reset email for ${email}`);
    return;
  }

  const resend = getResendClient();
  const resetUrl = `${SITE_URL}/obnovit-heslo?token=${token}`;
  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: email,
    subject: "Obnovení hesla — Gotrid Perfume",
    html: renderPasswordResetEmailHtml(resetUrl),
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
}
