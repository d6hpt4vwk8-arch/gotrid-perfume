"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin/require-admin";
import { logAdminActivity } from "@/lib/admin/activity-log";
import { buildUnsubscribeUrl } from "@/lib/marketing/unsubscribe";
import { EMAIL_FROM, getResendClient, isEmailConfigured } from "@/lib/email/resend";

const BATCH_SIZE = 100;

async function getOptedInEmails(): Promise<string[]> {
  const customers = await prisma.customer.findMany({
    where: { marketingOptIn: true },
    select: { email: true },
  });
  return customers.map((c) => c.email);
}

export async function getNewsletterRecipientCount(): Promise<number> {
  const emails = await getOptedInEmails();
  return emails.length;
}

export async function sendNewsletterCampaign(formData: FormData): Promise<void> {
  await requireAdmin();

  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!subject || !body) {
    throw new Error("Vyplňte prosím předmět i text e-mailu.");
  }
  if (!isEmailConfigured()) {
    throw new Error("RESEND_API_KEY není nastaven — e-maily se neodesílají.");
  }

  const recipients = await getOptedInEmails();

  const resend = getResendClient();
  let sent = 0;
  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const chunk = recipients.slice(i, i + BATCH_SIZE);
    const payload = await Promise.all(
      chunk.map(async (email) => ({
        from: EMAIL_FROM,
        to: email,
        subject,
        html: `
          ${body}
          <hr>
          <p style="font-size:12px;color:#666">
            Tento e-mail dostáváte, protože jste se na Gotrid Perfume přihlásili k odběru novinek.
            <a href="${await buildUnsubscribeUrl(email)}">Odhlásit se z těchto e-mailů</a>.
          </p>
        `,
      })),
    );
    const { error } = await resend.batch.send(payload);
    if (error) throw new Error(`Resend error: ${error.message}`);
    sent += chunk.length;
  }

  const campaign = await prisma.newsletterCampaign.create({
    data: { subject, body, recipientCount: sent },
  });
  await logAdminActivity({
    action: "newsletter.send",
    entityType: "NewsletterCampaign",
    entityId: campaign.id,
    detail: `"${subject}" odesláno ${sent} příjemcům`,
  });

  revalidatePath("/admin/newsletter");
}
