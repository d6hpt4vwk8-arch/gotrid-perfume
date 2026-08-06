import { ADMIN_COOKIE_NAME, verifySessionToken } from "@/lib/admin-auth";

/**
 * An order's `number` alone is too low-entropy to guard PII (name, address,
 * items) — this checks the opaque `accessToken` guests get via the
 * confirmation redirect/email, or falls back to an authenticated admin
 * session so the admin panel doesn't need to know the token.
 */
export async function verifyOrderAccess(
  order: { accessToken: string },
  providedToken: string | null | undefined,
  adminCookie: string | null | undefined,
): Promise<boolean> {
  if (providedToken && providedToken === order.accessToken) return true;
  return verifySessionToken(adminCookie);
}

export { ADMIN_COOKIE_NAME };
