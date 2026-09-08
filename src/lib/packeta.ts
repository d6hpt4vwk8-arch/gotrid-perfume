import { XMLBuilder, XMLParser } from "fast-xml-parser";

// Packeta (Zásilkovna) "REST" API — despite the name it's a plain POST of an
// XML document per method, not JSON: https://docs.packeta.com/docs/api-reference/api-methods
const API_URL = "https://www.zasilkovna.cz/api/rest";

const builder = new XMLBuilder({ format: false });
const parser = new XMLParser();

export class PacketaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PacketaError";
  }
}

function requireEnv(name: "PACKETA_API_PASSWORD" | "PACKETA_ESHOP_ID"): string {
  const value = process.env[name];
  if (!value) {
    throw new PacketaError(
      `${name} není nastavené v .env — doplňte ho, než budete moci vytvářet štítky Zásilkovna.`,
    );
  }
  return value;
}

async function callPacketaApi(method: string, params: Record<string, unknown>): Promise<unknown> {
  const apiPassword = requireEnv("PACKETA_API_PASSWORD");
  const body = builder.build({ [method]: { apiPassword, ...params } });

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/xml" },
    body,
  });

  if (!res.ok) {
    throw new PacketaError(`Packeta API vrátila HTTP ${res.status}.`);
  }

  const xml = await res.text();
  const parsed = parser.parse(xml) as {
    response?: {
      status?: string;
      result?: unknown;
      fault?: string | { faultString?: string };
      string?: string;
    };
  };
  const response = parsed.response;
  if (!response || response.status !== "ok") {
    // Packeta's fault shape varies: sometimes `fault.faultString` (object),
    // sometimes a top-level `string` alongside `fault` as a plain error-code
    // string (e.g. PacketAttributesFault) — fall back through both rather
    // than swallowing the real reason behind a generic message.
    const faultMessage =
      (typeof response?.fault === "object" ? response.fault?.faultString : undefined) ??
      response?.string ??
      "Neznámá chyba Packeta API.";
    throw new PacketaError(`Packeta API (${method}): ${faultMessage}`);
  }
  return response.result;
}

export type CreatePacketInput = {
  orderNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  pickupPointId: string;
  weightKg: number;
  value: number;
  codAmount: number | null;
};

/** Creates a Zásilkovna packet for a pickup-point delivery and returns its packet ID. */
export async function createPacket(input: CreatePacketInput): Promise<string> {
  const eshop = requireEnv("PACKETA_ESHOP_ID");

  const packetAttributes: Record<string, unknown> = {
    number: input.orderNumber,
    name: input.firstName,
    surname: input.lastName,
    email: input.email,
    phone: input.phone,
    addressId: input.pickupPointId,
    value: input.value.toFixed(2),
    currency: "CZK",
    weight: input.weightKg,
    eshop,
  };
  if (input.codAmount) {
    // Packeta rejects a fractional COD amount for CZK ("Unacceptable value
    // for CZK currency. Please fill in a whole number.") — cash pickup can't
    // handle heller fractions anyway, so round to the nearest whole crown.
    packetAttributes.cod = String(Math.round(input.codAmount));
  }

  const result = (await callPacketaApi("createPacket", { packetAttributes })) as { id?: string | number };
  if (!result?.id) {
    throw new PacketaError("Packeta API nevrátila ID vytvořené zásilky.");
  }
  return String(result.id);
}

export type LabelFormat = "A6 on A6" | "A7 on A7" | "A6 on A4" | "A7 on A4" | "105x35mm on A4" | "A8 on A8";

/** Fetches the shipping label PDF for an already-created packet. */
export async function fetchLabelPdf(packetId: string, format: LabelFormat = "A6 on A4"): Promise<Buffer> {
  const base64 = (await callPacketaApi("packetLabelPdf", {
    packetId,
    format,
    offset: 0,
  })) as string;
  if (!base64) {
    throw new PacketaError("Packeta API nevrátila štítek.");
  }
  return Buffer.from(base64, "base64");
}

// statusCode 7 = "delivered" (picked up by customer at the branch); 10 =
// "returned" (packet has been returned to the sender — the customer never
// picked it up within the branch's storage window) — see
// https://docs.packeta.com/docs/packet-tracking/status-codes
export const PACKETA_DELIVERED_STATUS_CODE = "7";
export const PACKETA_RETURNED_STATUS_CODE = "10";

/** Fetches the current Packeta status of a packet (statusCode 7 = delivered). */
export async function getPacketStatus(packetId: string): Promise<{ statusCode: string; codeText: string }> {
  const result = (await callPacketaApi("packetStatus", { packetId })) as {
    statusCode?: string | number;
    codeText?: string;
  };
  return { statusCode: String(result.statusCode ?? ""), codeText: result.codeText ?? "" };
}
