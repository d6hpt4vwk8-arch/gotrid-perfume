"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { logAdminActivity } from "@/lib/admin/activity-log";
import { requireAdmin } from "@/lib/admin/require-admin";

export interface ReceivingMatch {
  id: string;
  name: string;
  brand: string | null;
  ean: string | null;
  ownStock: number;
  visible: boolean;
  image: string | null;
}

// A camera reads a UPC-A as 12 digits while the catalog may hold it as EAN-13 with a leading zero (and the
// reverse), so both spellings are tried.
function eanVariants(raw: string): string[] {
  const digits = raw.replace(/\D/g, "");
  const variants = new Set<string>([digits]);
  if (digits.length === 12) variants.add(`0${digits}`);
  if (digits.length === 13 && digits.startsWith("0")) variants.add(digits.slice(1));
  return [...variants];
}

export async function lookupEan(raw: string): Promise<ReceivingMatch[]> {
  await requireAdmin();
  const variants = eanVariants(String(raw));
  if (variants[0].length < 8) return [];

  const products = await prisma.product.findMany({
    where: { ean: { in: variants } },
    select: {
      id: true,
      name: true,
      ean: true,
      ownStock: true,
      visible: true,
      brand: { select: { name: true } },
      images: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
    },
    take: 10,
  });

  // Several listings can share one EAN (supplier copies, a damaged-pack twin): the one already on our shelf and
  // the visible one go first, so the common case needs no choosing.
  return products
    .sort((a, b) => b.ownStock - a.ownStock || Number(b.visible) - Number(a.visible))
    .map((p) => ({
      id: p.id,
      name: p.name,
      brand: p.brand?.name ?? null,
      ean: p.ean,
      ownStock: p.ownStock,
      visible: p.visible,
      image: p.images[0]?.url ?? null,
    }));
}

const lineSchema = z.object({
  ean: z.string().trim().min(8).max(20),
  productId: z.string().trim().min(1).nullable(),
  qty: z.coerce.number().int().min(1).max(10_000),
});

export interface ReceivingResult {
  receivedUnits: number;
  receivedProducts: number;
  unknownEans: number;
}

// Adds to ownStock (updateOwnStock overwrites it with a recount; receiving goods is an increment). Like
// updateOwnStock, the supplier-fed `stock` is lifted to the new own count when it is lower, otherwise a
// product its supplier has run out of would still read "Vyprodáno" with our shelf full of it.
export async function receiveStock(input: { ean: string; productId: string | null; qty: number }[]): Promise<ReceivingResult> {
  await requireAdmin();
  const lines = z.array(lineSchema).max(500).parse(input);

  const known = lines.filter((l) => l.productId);
  const unknown = lines.filter((l) => !l.productId);

  const changes = await prisma.$transaction(async (tx) => {
    const done: { id: string; name: string; before: number; after: number }[] = [];
    for (const line of known) {
      const before = await tx.product.findUnique({
        where: { id: line.productId! },
        select: { name: true, ownStock: true, stock: true },
      });
      if (!before) continue;
      const after = before.ownStock + line.qty;
      await tx.product.update({
        where: { id: line.productId! },
        data: { ownStock: after, ...(after > before.stock ? { stock: after } : {}) },
      });
      done.push({ id: line.productId!, name: before.name, before: before.ownStock, after });
    }
    return done;
  });

  for (const c of changes) {
    await logAdminActivity({
      action: "product.own_stock_change",
      entityType: "Product",
      entityId: c.id,
      detail: `${c.name}: vlastní sklad ${c.before} ks → ${c.after} ks (příjem)`,
    });
  }
  // Goods whose EAN is not in the catalog yet: kept in the activity log until someone creates the product.
  for (const line of unknown) {
    await logAdminActivity({
      action: "receiving.unknown_ean",
      entityType: "Receiving",
      entityId: line.ean,
      detail: String(line.qty),
    });
  }

  revalidatePath("/admin/prijem-skladu");
  revalidatePath("/admin/vlastni-sklad");
  revalidatePath("/admin/produkty");

  return {
    receivedUnits: known.reduce((sum, l) => sum + l.qty, 0),
    receivedProducts: changes.length,
    unknownEans: unknown.length,
  };
}
