import { SITE_URL } from "@/lib/site";
import { EMAIL_FROM, getResendClient, isEmailConfigured } from "./resend";

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
    html: `
      <h1>Obnovení hesla</h1>
      <p>Požádali jste o obnovení hesla k účtu na Gotrid Perfume. Odkaz je platný 1 hodinu.</p>
      <p><a href="${resetUrl}">Nastavit nové heslo</a></p>
      <p>Pokud jste o obnovení hesla nežádali, tento e-mail můžete ignorovat.</p>
    `,
  });
  if (error) throw new Error(`Resend error: ${error.message}`);
}
