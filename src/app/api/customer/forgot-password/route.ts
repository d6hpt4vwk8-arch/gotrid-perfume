import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { forgotPasswordSchema } from "@/lib/customer/schemas";
import { createPasswordResetToken } from "@/lib/customer/password-reset";
import { sendPasswordResetEmail } from "@/lib/email/send-password-reset-email";
import { isRateLimited, recordRateLimitHit, getClientIp } from "@/lib/rate-limit";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60 * 60 * 1000;

// Always returns the same generic response regardless of whether the e-mail
// is registered — distinguishing the two would let an attacker enumerate
// which addresses have an account.
const GENERIC_MESSAGE =
  "Pokud u nás máte účet s touto e-mailovou adresou, poslali jsme na ni odkaz pro obnovení hesla.";

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const key = `forgot-password:${ip}`;

  if (await isRateLimited(key, MAX_ATTEMPTS, WINDOW_MS)) {
    return NextResponse.json(
      { error: "Příliš mnoho pokusů. Zkuste to prosím později." },
      { status: 429 },
    );
  }
  await recordRateLimitHit(key);

  const parsed = forgotPasswordSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Neplatná data." },
      { status: 400 },
    );
  }

  const customer = await prisma.customer.findUnique({ where: { email: parsed.data.email } });
  if (customer?.passwordHash) {
    const token = await createPasswordResetToken(customer.id);
    void sendPasswordResetEmail(customer.email, token).catch((err) =>
      console.error(`[email] password reset failed for ${customer.email}`, err),
    );
  }

  return NextResponse.json({ message: GENERIC_MESSAGE });
}
