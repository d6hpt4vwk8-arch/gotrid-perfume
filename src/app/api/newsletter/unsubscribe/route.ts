import { NextRequest, NextResponse } from "next/server";
import { recordUnsubscribe, verifyUnsubscribeSignature } from "@/lib/marketing/unsubscribe";

function page(title: string, body: string, status: number): NextResponse {
  return new NextResponse(
    `<!doctype html><html lang="cs"><head><meta charset="utf-8"><title>${title} — Gotrid Perfume</title></head>` +
      `<body style="font-family:sans-serif;max-width:32rem;margin:4rem auto;text-align:center">` +
      `<h1>${title}</h1><p>${body}</p></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email");
  const sig = req.nextUrl.searchParams.get("sig");
  if (!email || !sig || !(await verifyUnsubscribeSignature(email, sig))) {
    return page("Neplatný odkaz", "Odkaz pro odhlášení není platný.", 400);
  }

  await recordUnsubscribe(email);
  const safeEmail = email.replace(/[<>&]/g, "");
  return page(
    "Odhlášeno",
    `E-mail <strong>${safeEmail}</strong> byl odhlášen z odběru obchodních sdělení. Transakční e-maily k objednávkám tím nejsou dotčeny.`,
    200,
  );
}
