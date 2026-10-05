import { NextResponse } from "next/server";
import { z } from "zod";
import { cartHasPerfume } from "@/lib/gift-sticker";

const bodySchema = z.object({ productIds: z.array(z.string().min(1).max(200)).max(100) });

// Tells the checkout whether the cart qualifies for the free greeting sticker.
export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ eligible: false });
  return NextResponse.json({ eligible: await cartHasPerfume(parsed.data.productIds) });
}
