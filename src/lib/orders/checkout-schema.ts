import { z } from "zod";

export const checkoutSchema = z
  .object({
    email: z.string().max(320).email("Zadejte platný e-mail."),
    phone: z.string().min(9, "Zadejte platné telefonní číslo.").max(30),
    firstName: z.string().min(1, "Zadejte jméno.").max(100),
    lastName: z.string().min(1, "Zadejte příjmení.").max(100),
    shippingMethod: z.enum(["ZASILKOVNA", "PPL", "DPD", "BALIKOVNA", "OSOBNI_ODBER", "GLS", "GLS_MISTO"]),
    shippingCountry: z.enum(["CZ", "SK"]).optional().default("CZ"),
    paymentMethod: z.enum(["CARD", "BANK_TRANSFER", "CASH_ON_DELIVERY"]),
    pickupPointId: z.string().max(50).optional(),
    // Display name of the chosen pickup point — only actually required for
    // GLS_MISTO (see Order.pickupPointName in schema.prisma), optional here
    // so ZASILKOVNA/BALIKOVNA checkouts (which don't send it) still pass.
    pickupPointName: z.string().max(200).optional(),
    shippingStreet: z.string().max(200).optional(),
    shippingCity: z.string().max(100).optional(),
    shippingPostalCode: z.string().max(20).optional(),
    marketingConsent: z.boolean().optional().default(false),
    newsletterOptIn: z.boolean().optional().default(false),
    couponCode: z.string().trim().max(50).optional(),
    giftProductId: z.string().max(200).optional(),
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
    const usesPickupPoint =
      data.shippingMethod === "ZASILKOVNA" ||
      data.shippingMethod === "BALIKOVNA" ||
      data.shippingMethod === "GLS_MISTO";
    const usesAddress =
      data.shippingMethod === "PPL" || data.shippingMethod === "DPD" || data.shippingMethod === "GLS";
    if (usesPickupPoint && !data.pickupPointId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pickupPointId"],
        message: "Vyberte výdejní místo.",
      });
    }
    // Unlike Zásilkovna/Balíkovna (resolved against their own network from
    // pickupPointId alone), GLS's PSD service needs the point's own name and
    // address supplied explicitly at label-creation time — see gls.ts. The
    // picker fills these in automatically, so a missing value here means a
    // direct API call skipped the real flow, not a legitimate order.
    if (data.shippingMethod === "GLS_MISTO") {
      if (
        !data.pickupPointName ||
        !data.shippingStreet ||
        !data.shippingCity ||
        !data.shippingPostalCode
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["pickupPointId"],
          message: "Vyberte výdejní místo GLS.",
        });
      }
    }
    if (usesAddress) {
      if (!data.shippingStreet || !data.shippingCity || !data.shippingPostalCode) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["shippingStreet"],
          message: "Vyplňte doručovací adresu.",
        });
      }
    }
    // Zásilkovna is the only carrier with a real Slovak pickup-point network
    // today — enforced here, not just hidden in the UI, so a direct API call
    // can't smuggle in a combination we can't actually fulfil.
    if (data.shippingCountry === "SK" && data.shippingMethod !== "ZASILKOVNA") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["shippingMethod"],
        message: "Na Slovensko lze zatím doručit pouze přes Zásilkovnu.",
      });
    }
    // DPD retired 2026-09-04 (no API integration; GLS now covers the same
    // courier-to-address case) — still a valid ShippingMethod value for
    // historical orders, but rejected here so a direct API call can't pick
    // it for a new one, not just hidden from the checkout UI.
    if (data.shippingMethod === "DPD") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["shippingMethod"],
        message: "Doprava DPD již není dostupná, zvolte prosím jiný způsob dopravy.",
      });
    }
    // PPL temporarily paused 2026-09-04 — no signed contract with PPL yet.
    // Remove this block (and the matching filter in checkout-form.tsx) once
    // the contract is in place; still a valid ShippingMethod value so
    // historical PPL orders are unaffected.
    if (data.shippingMethod === "PPL") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["shippingMethod"],
        message: "Doprava PPL je dočasně nedostupná, zvolte prosím jiný způsob dopravy.",
      });
    }
    // Balíkovna retired 2026-09-08 — consolidating onto fewer carriers
    // (Zásilkovna + GLS) to build volume for better negotiated rates,
    // Balíkovna's standard (non-negotiated, unresponsive-to-negotiate)
    // price already exceeds what's charged at checkout, and Zásilkovna's
    // výdejní místo network already covers the same "pickup point" case.
    // Still a valid ShippingMethod value so historical Balíkovna orders
    // are unaffected.
    if (data.shippingMethod === "BALIKOVNA") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["shippingMethod"],
        message: "Doprava Balíkovna již není dostupná, zvolte prosím jiný způsob dopravy.",
      });
    }
  });

export type CheckoutInput = z.infer<typeof checkoutSchema>;
