"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { savedAddressSchema } from "./schemas";
import { getCurrentCustomerId } from "./get-current-customer";

export async function updateSavedAddress(formData: FormData) {
  const customerId = await getCurrentCustomerId();
  if (!customerId) throw new Error("Nejste přihlášeni.");

  const parsed = savedAddressSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Neplatná data.");
  }

  await prisma.customer.update({
    where: { id: customerId },
    data: {
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      phone: parsed.data.phone,
      addressStreet: parsed.data.addressStreet,
      addressCity: parsed.data.addressCity,
      addressPostalCode: parsed.data.addressPostalCode,
    },
  });

  revalidatePath("/muj-ucet");
}
