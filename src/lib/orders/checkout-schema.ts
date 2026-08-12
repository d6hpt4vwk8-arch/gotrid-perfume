import { z } from "zod";

export const checkoutSchema = z
  .object({
    email: z.string().max(320).email("Zadejte platný e-mail."),
    phone: z.string().min(9, "Zadejte platné telefonní číslo.").max(30),
    firstName: z.string().min(1, "Zadejte jméno.").max(100),
    lastName: z.string().min(1, "Zadejte příjmení.").max(100),
    shippingMethod: z.enum(["ZASILKOVNA", "PPL", "DPD", "BALIKOVNA"]),
    paymentMethod: z.enum(["CARD", "BANK_TRANSFER", "CASH_ON_DELIVERY"]),
    pickupPointId: z.string().max(50).optional(),
    shippingStreet: z.string().max(200).optional(),
    shippingCity: z.string().max(100).optional(),
    shippingPostalCode: z.string().max(20).optional(),
    marketingConsent: z.boolean().optional().default(false),
    couponCode: z.string().trim().max(50).optional(),
    items: z
      .array(
        z.object({
          productId: z.string().min(1).max(200),
          qty: z.number().int().positive().max(999),
        }),
      )
      .min(1, "Košík je prázdný.")
      .max(200),
  })
  .superRefine((data, ctx) => {
    const usesPickupPoint = data.shippingMethod === "ZASILKOVNA" || data.shippingMethod === "BALIKOVNA";
    if (usesPickupPoint && !data.pickupPointId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pickupPointId"],
        message: "Vyberte výdejní místo.",
      });
    }
    if (!usesPickupPoint) {
      if (!data.shippingStreet || !data.shippingCity || !data.shippingPostalCode) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["shippingStreet"],
          message: "Vyplňte doručovací adresu.",
        });
      }
    }
  });

export type CheckoutInput = z.infer<typeof checkoutSchema>;
