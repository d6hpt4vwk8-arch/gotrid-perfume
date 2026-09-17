import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateOrderNumber } from "./generate-order-number";
import { canUseCod, getCodSurcharge, getShippingPrice } from "@/lib/shipping";
import { getSettings } from "@/lib/settings.server";
import { previewCoupon, validateCoupon } from "@/lib/coupons";
import { redeemPoints } from "@/lib/loyalty";
import { CheckoutError } from "./checkout-error";
import type { CheckoutInput } from "./checkout-schema";

export { CheckoutError };

const MAX_ORDER_NUMBER_ATTEMPTS = 5;

export async function createOrder(input: CheckoutInput, customerId?: string | null) {
  const productIds = input.items.map((i) => i.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds }, visible: true },
  });
  const productById = new Map(products.map((p) => [p.id, p]));

  for (const item of input.items) {
    const product = productById.get(item.productId);
    if (!product) {
      throw new CheckoutError(`Produkt ${item.productId} už není dostupný.`);
    }
    if (product.stock < item.qty) {
      throw new CheckoutError(`Produkt "${product.name}" není skladem v požadovaném množství.`);
    }
  }

  const itemsTotal = input.items.reduce((sum, item) => {
    const product = productById.get(item.productId)!;
    return sum + Number(product.price) * item.qty;
  }, 0);

  const settings = await getSettings();

  if (input.paymentMethod === "CASH_ON_DELIVERY" && !canUseCod(itemsTotal, settings)) {
    throw new CheckoutError(
      `Dobírka není dostupná pro objednávky nad ${settings.freeShippingThreshold} Kč, zvolte prosím jiný způsob platby.`,
    );
  }

  const shippingPrice = getShippingPrice(input.shippingMethod, itemsTotal, settings, input.shippingCountry);
  const codSurcharge = getCodSurcharge(input.paymentMethod, settings);

  // The gift is re-checked here rather than trusted from the checkout form:
  // a direct API call could otherwise claim any product for free. A gift is
  // only ever earned by applying a GIFT-type coupon (checked read-only here;
  // validateCoupon() below re-checks it for real and burns the usage inside
  // the transaction) — not just by reaching some cart total, so that picking
  // one up means the customer actually saw and typed the promo code.
  let giftProduct: (typeof products)[number] | null = null;
  if (input.giftProductId) {
    if (!input.couponCode) {
      throw new CheckoutError("Dárek zdarma je podmíněný platným slevovým kódem.");
    }
    const couponPreview = await previewCoupon(input.couponCode, itemsTotal).catch(() => null);
    if (!couponPreview?.grantsGift) {
      throw new CheckoutError("Zadaný slevový kód neopravňuje k výběru dárku zdarma.");
    }
    giftProduct = await prisma.product.findFirst({
      where: { id: input.giftProductId, giftEligible: true, visible: true, stock: { gt: 0 } },
    });
    if (!giftProduct) {
      throw new CheckoutError("Vybraný dárek už bohužel není dostupný, zvolte prosím jiný.");
    }
  }

  for (let attempt = 0; attempt < MAX_ORDER_NUMBER_ATTEMPTS; attempt++) {
    const number = generateOrderNumber();
    try {
      return await prisma.$transaction(async (tx) => {
        for (const item of input.items) {
          const product = productById.get(item.productId)!;
          const updated = await tx.product.updateMany({
            where: { id: product.id, stock: { gte: item.qty } },
            data: { stock: { decrement: item.qty }, salesCount: { increment: item.qty } },
          });
          if (updated.count === 0) {
            throw new CheckoutError(`Produkt "${product.name}" mezitím vyprodán.`);
          }
        }

        if (giftProduct) {
          // Same guarded decrement as above (the gift may even be a product
          // that's also in the cart), but no salesCount bump — a giveaway
          // isn't a sale and shouldn't skew "Nejprodávanější".
          const giftStockTaken = await tx.product.updateMany({
            where: { id: giftProduct.id, stock: { gte: 1 } },
            data: { stock: { decrement: 1 } },
          });
          if (giftStockTaken.count === 0) {
            throw new CheckoutError(
              `Dárek "${giftProduct.name}" mezitím vyprodán, zvolte prosím jiný.`,
            );
          }
        }

        let couponCode: string | undefined;
        let discountAmount = 0;
        if (input.couponCode) {
          const result = await validateCoupon(tx, input.couponCode, itemsTotal);
          couponCode = result.code;
          discountAmount = result.discountAmount;
        }

        // Re-validated against the real ledger balance inside this same
        // transaction — never trusts input.pointsToRedeem as-is (see
        // redeemPoints' own doc comment). Capped against itemsTotal net of
        // the coupon discount already applied, so the two mechanisms can't
        // stack past what the customer is actually paying for goods.
        const pointsRedeemed = await redeemPoints(
          tx,
          input.email,
          input.pointsToRedeem,
          itemsTotal - discountAmount,
          settings,
        );

        const total = itemsTotal + shippingPrice + codSurcharge - discountAmount - pointsRedeemed;

        const order = await tx.order.create({
          data: {
            number,
            customerId: customerId ?? undefined,
            email: input.email,
            phone: input.phone,
            firstName: input.firstName,
            lastName: input.lastName,
            shippingMethod: input.shippingMethod,
            paymentMethod: input.paymentMethod,
            pickupPointId: input.pickupPointId,
            pickupPointName: input.pickupPointName,
            shippingStreet: input.shippingStreet,
            shippingCity: input.shippingCity,
            shippingPostalCode: input.shippingPostalCode,
            shippingCountry: input.shippingCountry,
            marketingConsent: input.marketingConsent,
            couponCode,
            discountAmount,
            pointsRedeemed,
            itemsTotal,
            shippingPrice,
            codSurcharge,
            total,
            // Default: same as `total`, CZK. Overwritten right after this
            // for CARD orders shipping to SK once the real Stripe-charged
            // EUR amount is known (see src/app/api/orders/route.ts) — every
            // other order (COD/bank transfer, or CZ) is genuinely charged
            // this CZK amount, so it's correct as the final value, not a
            // placeholder.
            chargedCurrency: "CZK",
            chargedAmount: total,
            items: {
              create: [
                ...input.items.map((item) => {
                  const product = productById.get(item.productId)!;
                  return {
                    productId: product.id,
                    name: product.name,
                    ean: product.ean,
                    qty: item.qty,
                    unitPrice: product.price,
                    vatRate: product.vatRate,
                  };
                }),
                ...(giftProduct
                  ? [
                      {
                        productId: giftProduct.id,
                        name: giftProduct.name,
                        ean: giftProduct.ean,
                        qty: 1,
                        unitPrice: new Prisma.Decimal(0),
                        vatRate: giftProduct.vatRate,
                        isGift: true,
                      },
                    ]
                  : []),
              ],
            },
          },
          include: { items: true },
        });

        if (pointsRedeemed > 0) {
          await tx.loyaltyTransaction.create({
            data: {
              email: input.email.trim().toLowerCase(),
              orderId: order.id,
              type: "REDEEM",
              points: -pointsRedeemed,
              note: `Uplatněno na objednávce ${order.number}`,
            },
          });
        }

        if (input.newsletterOptIn) {
          // Upsert by email rather than customerId — covers guest checkouts
          // (no Customer row yet) the same way as logged-in ones, and if the
          // email later becomes a full account, register() below claims this
          // row instead of bouncing on "already exists". Normalized the same
          // way registerSchema normalizes it, so the two paths always match
          // the same row instead of creating a case-variant duplicate.
          const email = input.email.trim().toLowerCase();
          await tx.customer.upsert({
            where: { email },
            update: { marketingOptIn: true },
            create: {
              email,
              firstName: input.firstName,
              lastName: input.lastName,
              phone: input.phone,
              marketingOptIn: true,
            },
          });
        }

        return order;
      });
    } catch (err) {
      const isDuplicateNumber =
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
      if (isDuplicateNumber && attempt < MAX_ORDER_NUMBER_ATTEMPTS - 1) {
        continue;
      }
      throw err;
    }
  }

  throw new CheckoutError("Nepodařilo se vygenerovat číslo objednávky, zkuste to znovu.");
}
