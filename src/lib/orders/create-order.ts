import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateOrderNumber } from "./generate-order-number";
import { getShippingPrice } from "@/lib/shipping";
import { getSettings } from "@/lib/settings.server";
import { validateCoupon } from "@/lib/coupons";
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
  const shippingPrice = getShippingPrice(input.shippingMethod, itemsTotal, settings);

  for (let attempt = 0; attempt < MAX_ORDER_NUMBER_ATTEMPTS; attempt++) {
    const number = generateOrderNumber();
    try {
      return await prisma.$transaction(async (tx) => {
        for (const item of input.items) {
          const product = productById.get(item.productId)!;
          const updated = await tx.product.updateMany({
            where: { id: product.id, stock: { gte: item.qty } },
            data: { stock: { decrement: item.qty } },
          });
          if (updated.count === 0) {
            throw new CheckoutError(`Produkt "${product.name}" mezitím vyprodán.`);
          }
        }

        let couponCode: string | undefined;
        let discountAmount = 0;
        if (input.couponCode) {
          const result = await validateCoupon(tx, input.couponCode, itemsTotal);
          couponCode = result.code;
          discountAmount = result.discountAmount;
        }
        const total = itemsTotal + shippingPrice - discountAmount;

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
            shippingStreet: input.shippingStreet,
            shippingCity: input.shippingCity,
            shippingPostalCode: input.shippingPostalCode,
            marketingConsent: input.marketingConsent,
            couponCode,
            discountAmount,
            itemsTotal,
            shippingPrice,
            total,
            items: {
              create: input.items.map((item) => {
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
            },
          },
          include: { items: true },
        });

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
