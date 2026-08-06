import { createHash } from "node:crypto";

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const GRAPH_API_VERSION = "v21.0";

export function isMetaCapiConfigured(): boolean {
  return Boolean(PIXEL_ID && process.env.META_CONVERSIONS_API_TOKEN);
}

function sha256(value: string): string {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

export interface MetaCapiUserData {
  email?: string;
  clientIp?: string;
  userAgent?: string;
}

export interface MetaCapiEvent {
  eventName: "ViewContent" | "AddToCart" | "Purchase";
  eventId: string;
  eventSourceUrl: string;
  user: MetaCapiUserData;
  customData?: Record<string, unknown>;
}

/**
 * Sends a server-side event to Meta's Conversions API, mirroring the
 * client-side Pixel event with the same event_id for deduplication (TZ §7.4,
 * §10 acceptance: "dedupликace event_id"). No-ops quietly until the owner
 * supplies META_CONVERSIONS_API_TOKEN.
 */
export async function sendMetaCapiEvent(event: MetaCapiEvent): Promise<void> {
  if (!isMetaCapiConfigured()) {
    console.warn(`[meta-capi] not configured — skipping ${event.eventName} (${event.eventId})`);
    return;
  }

  const payload = {
    data: [
      {
        event_name: event.eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: event.eventId,
        event_source_url: event.eventSourceUrl,
        action_source: "website",
        user_data: {
          ...(event.user.email && { em: [sha256(event.user.email)] }),
          ...(event.user.clientIp && { client_ip_address: event.user.clientIp }),
          ...(event.user.userAgent && { client_user_agent: event.user.userAgent }),
        },
        custom_data: event.customData ?? {},
      },
    ],
  };

  const res = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${PIXEL_ID}/events?access_token=${process.env.META_CONVERSIONS_API_TOKEN}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );

  if (!res.ok) {
    console.error(`[meta-capi] ${event.eventName} failed: ${res.status} ${await res.text()}`);
  }
}
