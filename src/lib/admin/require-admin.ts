import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, verifySessionToken } from "@/lib/admin-auth";

/**
 * Server Actions are public HTTP endpoints (Next.js docs) — middleware only
 * covers the page/route matcher, so a routing regression, a new entry point,
 * or a framework bug could reach an action without going through it. Call
 * this as the first line of every admin Server Action so authorization
 * doesn't depend solely on middleware.
 */
export async function requireAdmin(): Promise<void> {
  const cookieStore = await cookies();
  const isAuthed = await verifySessionToken(cookieStore.get(ADMIN_COOKIE_NAME)?.value);
  if (!isAuthed) {
    throw new Error("Neautorizováno.");
  }
}
