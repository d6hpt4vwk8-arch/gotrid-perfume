import { ADMIN_COOKIE_NAME, verifySessionToken } from "@/lib/admin-auth";

/** HttpOnly cookie holding the order's accessToken after the one-time exchange in /api/orders/[number]/access — never put back in a URL, see that route's comment. */
export const ORDER_ACCESS_COOKIE_NAME = "gotrid_order_access";

/**
 * An order's `number` alone is too low-entropy to guard PII (name, address,
 * items). Access is granted if any of: the logged-in customer owns the
 * order, the order-access cookie carries the right token, or an admin
 * session is present — so the admin panel doesn't need to know the token.
 */
export async function verifyOrderAccess(
  order: { accessToken: string; customerId: string | null },
  opts: {
    cookieToken?: string | null;
    adminCookie?: string | null;
    customerId?: string | null;
  },
): Promise<boolean> {
  if (opts.customerId && order.customerId && opts.customerId === order.customerId) return true;
  if (opts.cookieToken && opts.cookieToken === order.accessToken) return true;
  return verifySessionToken(opts.adminCookie);
}

export { ADMIN_COOKIE_NAME };
