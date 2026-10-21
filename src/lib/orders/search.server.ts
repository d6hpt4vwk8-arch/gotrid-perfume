import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// Czech/Slovak letters → plain ASCII. Applied in SQL (translate) to the stored
// text and in JS to the typed token, so "Porizkova" finds "Pořízková" (and
// vice versa) without needing the Postgres `unaccent` extension.
const ACCENTED = "áäčďéěëíĺľňóôöŕřšťúůüýž";
const PLAIN = "aacdeeeillnooorrstuuuyz";

function stripAccents(text: string): string {
  return text
    .toLowerCase()
    .split("")
    .map((ch) => {
      const i = ACCENTED.indexOf(ch);
      return i === -1 ? ch : PLAIN[i];
    })
    .join("");
}

// translate(lower(col), accented, plain) — the column side of the comparison.
function norm(col: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`translate(lower(${col}), ${ACCENTED}, ${PLAIN})`;
}

/**
 * Ids of orders matching a free-text admin search. The query is split into
 * words and EVERY word must match somewhere (AND), each word matching any of:
 * order number, first/last name, company, phone, e-mail, or a line item's
 * name / EAN / product code. That is what makes "Jan Novák" (first + last name
 * typed together) work, which a single-column `contains` never could.
 */
export async function findOrderIdsBySearch(query: string): Promise<string[]> {
  const tokens = stripAccents(query)
    .split(/\s+/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 8);
  if (tokens.length === 0) return [];

  const perToken = tokens.map((token) => {
    const like = `%${token.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    return Prisma.sql`(
      ${norm(Prisma.sql`o."number"`)} LIKE ${like}
      OR ${norm(Prisma.sql`o."firstName"`)} LIKE ${like}
      OR ${norm(Prisma.sql`o."lastName"`)} LIKE ${like}
      OR ${norm(Prisma.sql`coalesce(o."companyName", '')`)} LIKE ${like}
      OR ${norm(Prisma.sql`o."phone"`)} LIKE ${like}
      OR ${norm(Prisma.sql`o."email"`)} LIKE ${like}
      OR EXISTS (
        SELECT 1 FROM "OrderItem" oi
        LEFT JOIN "Product" p ON p."id" = oi."productId"
        WHERE oi."orderId" = o."id" AND (
          ${norm(Prisma.sql`oi."name"`)} LIKE ${like}
          OR ${norm(Prisma.sql`coalesce(oi."ean", '')`)} LIKE ${like}
          OR ${norm(Prisma.sql`coalesce(p."code", '')`)} LIKE ${like}
          OR ${norm(Prisma.sql`coalesce(p."ean", '')`)} LIKE ${like}
        )
      )
    )`;
  });

  const rows = await prisma.$queryRaw<{ id: string }[]>(
    Prisma.sql`SELECT o."id" FROM "Order" o WHERE ${Prisma.join(perToken, " AND ")}`,
  );
  return rows.map((r) => r.id);
}
