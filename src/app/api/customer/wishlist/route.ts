import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getCurrentCustomerId } from "@/lib/customer/get-current-customer";

// Server copy of a logged-in customer's favourites (the guest wishlist stays
// in the browser). The client keeps localStorage as its working copy and
// syncs here — see src/lib/wishlist-context.tsx.
const MAX_ITEMS = 200;

async function listIds(customerId: string): Promise<string[]> {
  const rows = await prisma.wishlistItem.findMany({
    where: { customerId },
    select: { productId: true },
    orderBy: { createdAt: "asc" },
  });
  return rows.map((r) => r.productId);
}

export async function GET() {
  const customerId = await getCurrentCustomerId();
  if (!customerId) return NextResponse.json({ loggedIn: false, productIds: [] });
  return NextResponse.json({ loggedIn: true, productIds: await listIds(customerId) });
}

const mergeSchema = z.object({ productIds: z.array(z.string().min(1)).max(MAX_ITEMS) });
const toggleSchema = z.object({ productId: z.string().min(1), on: z.boolean() });

/** Adds products to the customer's favourites at the current price; never removes anything. */
async function addProducts(customerId: string, productIds: string[]) {
  const have = new Set(await listIds(customerId));
  const wanted = [...new Set(productIds)].filter((id) => !have.has(id));
  if (wanted.length === 0 || have.size + wanted.length > MAX_ITEMS) return;
  const products = await prisma.product.findMany({
    where: { id: { in: wanted }, visible: true },
    select: { id: true, price: true },
  });
  await prisma.wishlistItem.createMany({
    data: products.map((p) => ({ customerId, productId: p.id, priceAtAdd: p.price })),
    skipDuplicates: true,
  });
}

// Guest → account: merge the browser's list into the account's one.
export async function PUT(req: NextRequest) {
  const customerId = await getCurrentCustomerId();
  if (!customerId) return NextResponse.json({ error: "Neautorizováno." }, { status: 401 });
  const parsed = mergeSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Neplatný požadavek." }, { status: 400 });
  await addProducts(customerId, parsed.data.productIds);
  return NextResponse.json({ productIds: await listIds(customerId) });
}

export async function POST(req: NextRequest) {
  const customerId = await getCurrentCustomerId();
  if (!customerId) return NextResponse.json({ error: "Neautorizováno." }, { status: 401 });
  const parsed = toggleSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Neplatný požadavek." }, { status: 400 });
  const { productId, on } = parsed.data;
  if (on) await addProducts(customerId, [productId]);
  else await prisma.wishlistItem.deleteMany({ where: { customerId, productId } });
  return NextResponse.json({ ok: true });
}
