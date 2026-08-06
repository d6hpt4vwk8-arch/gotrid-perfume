import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendMetaCapiEvent } from "@/lib/analytics/meta-capi";

const bodySchema = z.object({
  eventName: z.enum(["ViewContent", "AddToCart"]),
  eventId: z.string().min(1),
  eventSourceUrl: z.string().url(),
  customData: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  const { eventName, eventId, eventSourceUrl, customData } = parsed.data;

  await sendMetaCapiEvent({
    eventName,
    eventId,
    eventSourceUrl,
    user: {
      clientIp: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
      userAgent: req.headers.get("user-agent") ?? undefined,
    },
    customData,
  });

  return NextResponse.json({ ok: true });
}
