import { z } from "zod";

export const checkoutSchema = z
  .object({
    email: z.string().email("Zadejte platný e-mail."),
    phone: z.string().min(9, "Zadejte platné telefonní číslo."),
    firstName: z.string().min(1, "Zadejte jméno."),
    lastName: z.string().min(1, "Zadejte příjmení."),
    shippingMethod: z.enum(["ZASILKOVNA", "PPL", "DPD", "BALIKOVNA"]),
    paymentMethod: z.enum(["CARD", "BANK_TRANSFER", "CASH_ON_DELIVERY"]),
    pickupPointId: z.string().optional(),
    shippingStreet: z.string().optional(),
    shippingCity: z.string().optional(),
    shippingPostalCode: z.string().optional(),
    marketingConsent: z.boolean().optional().default(false),
    couponCode: z.string().trim().max(50).optional(),
    items: z
      .array(
        z.object({
          productId: z.string().min(1),
          qty: z.number().int().positive(),
        }),
      )
      .min(1, "Košík je prázdný."),
  })
  .superRefine((data, ctx) => {
    if (data.shippingMethod === "ZASILKOVNA" && !data.pickupPointId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pickupPointId"],
        message: "Vyberte výdejní místo Zásilkovny.",
      });
    }
    if (data.shippingMethod !== "ZASILKOVNA") {
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
