process.env.COMGATE_MERCHANT = "521131";
process.env.COMGATE_SECRET = "unit-test-secret";
import { NextRequest } from "next/server";
async function main() {
  const { POST } = await import("../../src/app/api/webhooks/comgate/route");
  const mk = (body: string) => new NextRequest("http://localhost:3000/api/webhooks/comgate", { method: "POST", body, headers: { "content-type": "application/x-www-form-urlencoded" } });
  let r = await POST(mk("merchant=521131&transId=AAAA-BBBB-CCCC&secret=wrong&status=PAID"));
  console.log("wrong secret ->", r.status, await r.text());
  r = await POST(mk("merchant=999&transId=AAAA-BBBB-CCCC&secret=unit-test-secret&status=PAID"));
  console.log("wrong merchant ->", r.status, await r.text());
  r = await POST(mk("merchant=521131&secret=unit-test-secret&status=PAID"));
  console.log("no transId ->", r.status, await r.text());
  r = await POST(mk("merchant=521131&transId=AAAA-BBBB-CCCC&secret=unit-test-secret&status=PAID&refId=X"));
  console.log("unknown transId ->", r.status, await r.text());
  const { GET } = await import("../../src/app/api/payments/comgate/return/route");
  const g = await GET(new NextRequest("http://localhost:3000/api/payments/comgate/return?id=AAAA-BBBB-CCCC&refId=GT000000-0000"));
  console.log("return unknown ->", g.status, g.headers.get("location"), g.headers.get("set-cookie") ? "COOKIE SET" : "no cookie");
  const { createComgatePayment } = await import("../../src/lib/payments/comgate");
  try { await createComgatePayment({ orderNumber: "GT-TEST", amount: 1, currency: "CZK", email: "a@b.cz", fullName: "T T", country: "CZ", lang: "cs", urlPaid: "https://x/a", urlCancelled: "https://x/b", urlPending: "https://x/c" }); } catch (e) { console.log("create with fake secret ->", (e as Error).message); }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
