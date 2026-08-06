import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { CUSTOMER_COOKIE_NAME, verifyCustomerSessionToken } from "./session";

export async function getCurrentCustomerId(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(CUSTOMER_COOKIE_NAME)?.value;
  return verifyCustomerSessionToken(token);
}

export async function getCurrentCustomer() {
  const customerId = await getCurrentCustomerId();
  if (!customerId) return null;
  return prisma.customer.findUnique({ where: { id: customerId } });
}
