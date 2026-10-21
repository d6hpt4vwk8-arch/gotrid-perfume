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
  type AttributeFault = { name?: string; fault?: string };
  const parsed = parser.parse(xml) as {
    response?: {
      status?: string;
      result?: unknown;
      fault?: string | { faultString?: string };
      string?: string;
      // Present specifically for PacketAttributesFault — pinpoints which
      // field failed and why, e.g. "Order nr. X: Phone number is not in
      // valid format, dialing code is required." `string` alone ("Failed to
      // validate attributes. See detail.") is the generic wrapper around
      // this, so prefer it whenever it's there.
      detail?: { attributes?: { fault?: AttributeFault | AttributeFault[] } };
    };
  };
  const response = parsed.response;
  if (!response || response.status !== "ok") {
    const attributeFaults = response?.detail?.attributes?.fault;
    const attributeMessage = attributeFaults
      ? (Array.isArray(attributeFaults) ? attributeFaults : [attributeFaults])
          .map((f) => f.fault)
          .filter(Boolean)
          .join("; ")
      : undefined;
    // Packeta's fault shape varies: sometimes `fault.faultString` (object),
    // sometimes a top-level `string` alongside `fault` as a plain error-code
    // string (e.g. PacketAttributesFault) — fall back through both rather
    // than swallowing the real reason behind a generic message.
    const faultMessage =
      attributeMessage ||
      (typeof response?.fault === "object" ? response.fault?.faultString : undefined) ||
      response?.string ||
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

export type CreateAddressPacketInput = {
  orderNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  postalCode: string;
  country: "CZ" | "SK";
  weightKg: number;
  /** Declared value and COD are in `currency` — Packeta requires EUR for Slovak parcels. */
  currency: "CZK" | "EUR";
  value: number;
  codAmount: number | null;
};

// Packeta carrier ids for "home delivery" (addressId of an address packet).
// 106 = Zásilkovna Česko — doručení na adresu, 131 = Zásilkovna Slovensko — doručení na adresu.
const HOME_DELIVERY_CARRIER_ID: Record<"CZ" | "SK", number> = { CZ: 106, SK: 131 };

/** "Fraňa Kráľa 276/30" → street + house number as Packeta wants them separately. */
function splitStreet(full: string): { street: string; houseNumber: string } {
  const m = full.trim().match(/^(.*?)[\s,]+(\d+[a-zA-Z]?(?:\/\d+[a-zA-Z]?)?)$/);
  return m ? { street: m[1].trim(), houseNumber: m[2] } : { street: full.trim(), houseNumber: "" };
}

/** Creates a Zásilkovna packet for home (address) delivery and returns its packet ID. */
export async function createAddressPacket(input: CreateAddressPacketInput): Promise<string> {
  const eshop = requireEnv("PACKETA_ESHOP_ID");
  const { street, houseNumber } = splitStreet(input.street);
  const money = (n: number) => (input.currency === "CZK" ? String(Math.round(n)) : n.toFixed(2));

  const packetAttributes: Record<string, unknown> = {
    number: input.orderNumber,
    name: input.firstName,
    surname: input.lastName,
    email: input.email,
    phone: input.phone,
    addressId: HOME_DELIVERY_CARRIER_ID[input.country],
    street,
    houseNumber,
    city: input.city.trim(),
    zip: input.postalCode.replace(/\s+/g, ""),
    value: money(input.value),
    currency: input.currency,
    weight: input.weightKg,
    eshop,
  };
  if (input.codAmount) packetAttributes.cod = money(input.codAmount);

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

/** Full tracking history of a packet (every status with its timestamp), oldest first — for audits like COD payout timing. */
export async function getPacketHistory(packetId: string): Promise<{ dateTime: string; statusCode: string; codeText: string }[]> {
  const result = (await callPacketaApi("packetTracking", { packetId })) as {
    record?: { dateTime?: string; statusCode?: string | number; codeText?: string } | { dateTime?: string; statusCode?: string | number; codeText?: string }[];
  };
  const records = Array.isArray(result.record) ? result.record : result.record ? [result.record] : [];
  return records
    .map((r) => ({ dateTime: r.dateTime ?? "", statusCode: String(r.statusCode ?? ""), codeText: r.codeText ?? "" }))
    .sort((a, b) => (a.dateTime < b.dateTime ? -1 : 1));
}

/** Fetches the current Packeta status of a packet (statusCode 7 = delivered). */
export async function getPacketStatus(packetId: string): Promise<{ statusCode: string; codeText: string }> {
  const result = (await callPacketaApi("packetStatus", { packetId })) as {
    statusCode?: string | number;
    codeText?: string;
  };
  return { statusCode: String(result.statusCode ?? ""), codeText: result.codeText ?? "" };
}
