"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { redeemReward } from "@/lib/loyalty-rewards";
import { getCurrentCustomerId } from "./get-current-customer";

export async function redeemLoyaltyReward(formData: FormData) {
  const customerId = await getCurrentCustomerId();
  if (!customerId) throw new Error("Nejste přihlášeni.");
  const customer = await prisma.customer.findUniqueOrThrow({ where: { id: customerId }, select: { email: true } });
  await redeemReward(customer.email, String(formData.get("rewardId") ?? ""));
  revalidatePath("/muj-ucet");
}
