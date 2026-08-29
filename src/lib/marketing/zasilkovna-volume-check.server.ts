import { prisma } from "@/lib/prisma";
import { logAdminActivity } from "@/lib/admin/activity-log";
import { EMAIL_FROM, getResendClient, isEmailConfigured } from "@/lib/email/resend";

const VOLUME_THRESHOLD = 100;
const WINDOW_DAYS = 30;
const OWNER_EMAIL = "pavlohrytsan@gmail.com";

/**
 * One-time nudge for the owner: once trailing-30-day Zásilkovna volume
 * crosses a threshold worth renegotiating over, email a reminder to ask
 * Zásilkovna for a repricing review (their contracted rate is volume-based
 * and doesn't auto-improve on its own). Fires at most once — after sending,
 * Settings.zasilkovnaVolumeAlertSentAt is set and this becomes a no-op
 * forever, so the daily cron can call it indefinitely without nagging.
 */
export async function checkZasilkovnaVolumeMilestone() {
  const settings = await prisma.settings.findUnique({ where: { id: "singleton" } });
  if (settings?.zasilkovnaVolumeAlertSentAt) return { sent: false, reason: "already-sent" as const };

  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const count = await prisma.order.count({
    where: { shippingMethod: "ZASILKOVNA", createdAt: { gte: since } },
  });

  if (count < VOLUME_THRESHOLD) return { sent: false, reason: "below-threshold" as const, count };

  if (isEmailConfigured()) {
    const resend = getResendClient();
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: OWNER_EMAIL,
      subject: "Zásilkovna — čas požádat o přehodnocení tarifu",
      html: `
        <h1>Ahoj!</h1>
        <p>Za posledních ${WINDOW_DAYS} dní jste přes Zásilkovnu odeslali <strong>${count}</strong> zásilek —
        to je dobrý objem na to, abyste jim napsali a požádali o přehodnocení aktuálního tarifu.</p>
      `,
    });
    if (error) throw new Error(`Resend error: ${error.message}`);
  }

  await prisma.settings.upsert({
    where: { id: "singleton" },
    update: { zasilkovnaVolumeAlertSentAt: new Date() },
    create: { id: "singleton", zasilkovnaVolumeAlertSentAt: new Date() },
  });
  await logAdminActivity({
    action: "zasilkovna_volume_alert_sent",
    entityType: "Settings",
    entityId: "singleton",
    detail: `Trailing ${WINDOW_DAYS}-day Zásilkovna order count reached ${count} (threshold ${VOLUME_THRESHOLD}).`,
  });

  return { sent: true, count };
}
