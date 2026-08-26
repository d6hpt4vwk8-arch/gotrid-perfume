import { randomUUID, createHash, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Agent, fetch as undiciFetch } from "undici";

// Česká pošta nAPI B2B — ZSKService (Balíkovna parcel shipments).
// Spec: B2B-ZSKService OpenAPI (obtained from postaonline.cz → Služby pro
// firmy → Správa B2B profilu). REST/JSON, not the older SOAP B2B service.
// FAQ (nAPI – nejčastější dotazy a vyskytující se chyby, ceskaposta.cz)
// filled in several gaps the spec itself leaves silent — see the comments
// below on locationNumber, prefixParcelCode, and the address fields.
const API_URL = "https://b2b.postaonline.cz:444/restservices/ZSKService/v1";

// b2b.postaonline.cz serves a cert chain rooted at PostSignum (Česká pošta's
// own qualified CA), which isn't in Node's/Vercel's default trust store —
// plain fetch() fails the TLS handshake with an opaque "fetch failed" and no
// further detail. Rather than disabling verification, trust this specific
// CA chain (root + intermediate, same pair the reference Ruby B2B client
// bundles) via a dedicated dispatcher.
const postsignumCerts = ["postsignum_qca4_root.pem", "postsignum_vca5_sub.pem"].map((file) =>
  readFileSync(path.join(process.cwd(), "src/lib/certs", file), "utf8"),
);
const balikovnaDispatcher = new Agent({ connect: { ca: postsignumCerts } });

// Sender identifiers from Dohoda č. 2026/00278 (ID CČK 503806001).
const CUSTOMER_ID = "M17422"; // technologické číslo podavatele
const POST_CODE = "13000"; // PSČ podací pošty
const PARCEL_PREFIX = "NB"; // Balíkovna/Box parcel type — "BA" (the YAML's generic example value) is wrong here and produces INVALID_LOCATION regardless of address.
// The account's one registered podací místo (see setup note below) —
// required in every parcelServiceHeaderCom or every call fails with
// responseCode 11 "INVALID_LOCATION", no matter what else is right.
const LOCATION_NUMBER = 1;

export class BalikovnaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BalikovnaError";
  }
}

function requireEnv(name: "BALIKOVNA_API_TOKEN" | "BALIKOVNA_PRIVATE_KEY"): string {
  const value = process.env[name];
  if (!value) {
    throw new BalikovnaError(
      `${name} není nastavené v .env — doplňte ho, než budete moci vytvářet štítky Balíkovna.`,
    );
  }
  return value;
}

// HMAC_SHA256_Auth per the nAPI spec: sign
// "Authorization-Content-SHA256;Authorization-Timestamp;nonce" with the
// secret key, base64-encode the result. The spec describes the secret key
// as "in Base64 format" but that's just its storage encoding — verified
// against the live API that the HMAC key is the base64 *string* itself
// (its raw UTF-8 bytes), not the bytes you get from base64-decoding it.
function buildAuthHeaders(bodyJson: string) {
  const apiToken = requireEnv("BALIKOVNA_API_TOKEN");
  const privateKey = requireEnv("BALIKOVNA_PRIVATE_KEY");

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const contentSha256 = createHash("sha256").update(bodyJson, "utf8").digest("hex");
  const nonce = randomUUID();
  const signedString = `${contentSha256};${timestamp};${nonce}`;
  const signature = createHmac("sha256", privateKey).update(signedString, "utf8").digest("base64");

  return {
    "Content-Type": "application/json",
    "Api-Token": apiToken,
    "Authorization-Timestamp": timestamp,
    "Authorization-Content-SHA256": contentSha256,
    Authorization: `CP-HMAC-SHA256 nonce="${nonce}", signature="${signature}"`,
  };
}

export type CreateParcelInput = {
  recordId: string; // our order number, echoed back in the response
  weightKg: number;
  // Declared value of the contents — required by the API for prefix "NB"
  // (responseCode 336 MISSING_REQUIRED_PRICE otherwise). Distinct from
  // codAmount below: that one is the Amount schema, literally documented
  // as "Cash on delivery amount", a separate field.
  insuredValue: number;
  codAmount: number | null;
  recipient: {
    firstName: string;
    surname: string;
    mobilNumber?: string;
    // Required for prefix "NB" (responseCode 250 MISSING_REQUIRED_EMAIL
    // otherwise) — the box notifies the recipient by email when it's ready
    // for pickup.
    emailAddress: string;
  };
  // BalikovnaPoint.id (the výdejní místo/AlzaBox the customer picked at
  // checkout). The 1.4.0 spec has no dedicated "route to this point" field
  // — undocumented there, only in Česká pošta's nAPI FAQ PDF: for prefix
  // "NB" the point's ID goes in the address's zipCode field, with every
  // other address field left empty (a real street/city there produces
  // responseCode 247 INVALID_ADDRESS, not a location match).
  pickupPointId: string;
};

type ParcelServiceResponse = {
  responseHeader?: {
    resultHeader?: { responseCode: number; responseText: string };
    resultParcelData?: Array<{
      recordNumber: string;
      parcelCode: string;
      parcelStateResponse?: Array<{ responseCode: number; responseText: string }>;
    }>;
    responsePrintParams?: {
      file?: string; // base64 PDF
      printParamsResponse?: Array<{ responseCode: number; responseText: string }>;
    };
  };
};

/**
 * Creates a Balíkovna/Box parcel and, in the same call, renders its address
 * label as a PDF (idForm 101 = harmonized label, independent — idForm 21,
 * the plain address label, fails prefix "NB" with responseCode 378
 * INVALID_PREFIX_COMBINATION).
 */
export async function createParcel(
  input: CreateParcelInput,
): Promise<{ parcelCode: string; labelPdf: Buffer }> {
  const body = {
    parcelServiceHeader: {
      parcelServiceHeaderCom: {
        transmissionDate: new Date().toISOString().slice(0, 10),
        customerID: CUSTOMER_ID,
        postCode: POST_CODE,
        locationNumber: LOCATION_NUMBER,
      },
      printParams: { idForm: 101, shiftHorizontal: 0, shiftVertical: 0 },
    },
    parcelServiceData: {
      parcelParams: {
        recordID: input.recordId,
        prefixParcelCode: PARCEL_PREFIX,
        weight: input.weightKg.toFixed(3),
        insuredValue: input.insuredValue,
        currency: "CZK",
        ...(input.codAmount ? { amount: input.codAmount } : {}),
      },
      // parcelServices (sibling of parcelParams, NOT a property inside it —
      // confirmed against the official OpenAPI spec at postaonline.cz/dokumentaceapi/b2b/zsk,
      // schema ParcelData.parcelServices) declares which doplňková služba
      // applies. For COD it's mandatory — omitting it fails with responseCode
      // 19 BATCH_INVALID / 267 MISSING_REQUIRED_SERVICE_4/5/41/Du/Dh, which
      // (unhelpfully) doesn't say *which* field is missing. "Du" = "Dobírka –
      // účet" (COD paid out to the sender's bank account, not cash at the
      // counter — the right choice for us regardless of pickup point type).
      // Value casing matters: "DU" is rejected, only "Du" works.
      ...(input.codAmount ? { parcelServices: ["Du"] } : {}),
      parcelAddress: {
        firstName: input.recipient.firstName,
        surname: input.recipient.surname,
        address: { isoCountry: "CZ", zipCode: input.pickupPointId },
        emailAddress: input.recipient.emailAddress,
        ...(input.recipient.mobilNumber ? { mobilNumber: input.recipient.mobilNumber } : {}),
      },
    },
  };

  const bodyJson = JSON.stringify(body);
  // Node's global fetch and the npm `undici` package are separate bundled
  // instances — passing an Agent built from the npm package as `dispatcher`
  // to global fetch fails with "invalid onRequestStart method" (learned the
  // hard way in production). Using undici's own fetch keeps both from the
  // same instance.
  let res: Awaited<ReturnType<typeof undiciFetch>>;
  try {
    res = await undiciFetch(`${API_URL}/parcelService`, {
      method: "POST",
      headers: buildAuthHeaders(bodyJson),
      body: bodyJson,
      dispatcher: balikovnaDispatcher,
    });
  } catch (err) {
    const cause = err instanceof Error ? err.cause : undefined;
    console.error("Balíkovna API request failed:", err, "cause:", cause, "body:", bodyJson);
    const detail = cause instanceof Error ? cause.message : err instanceof Error ? err.message : String(err);
    throw new BalikovnaError(`Balíkovna API — chyba spojení: ${detail}`);
  }

  const rawText = await res.text();
  if (!res.ok) {
    console.error("Balíkovna API non-OK response:", res.status, rawText, "body:", bodyJson);
    throw new BalikovnaError(`Balíkovna API vrátila HTTP ${res.status}: ${rawText}`);
  }

  let parsed: ParcelServiceResponse;
  try {
    parsed = JSON.parse(rawText) as ParcelServiceResponse;
  } catch {
    console.error("Balíkovna API returned non-JSON body:", rawText, "body:", bodyJson);
    throw new BalikovnaError(`Balíkovna API vrátila neplatnou odpověď: ${rawText.slice(0, 500)}`);
  }
  const header = parsed.responseHeader;
  const resultHeader = header?.resultHeader;
  const parcel = header?.resultParcelData?.[0];
  const parcelError = parcel?.parcelStateResponse?.find((s) => s.responseCode !== 1);

  // responseCode 1 = OK — NOT 0. Every non-1 code (11 INVALID_LOCATION, 19
  // BATCH_INVALID, ...) is an error; confirmed against the live API.
  // 19 BATCH_INVALID specifically is just a generic "batch has bad records"
  // wrapper — the real per-record reason (bad weight, missing size category,
  // etc.) lives in resultParcelData[0].parcelStateResponse, so prefer that
  // over the header's generic text whenever it's present.
  if (resultHeader && resultHeader.responseCode !== 1) {
    console.error("Balíkovna API error response:", rawText, "body:", bodyJson);
    throw new BalikovnaError(`Balíkovna API: ${parcelError?.responseText ?? resultHeader.responseText}`);
  }

  if (!parcel?.parcelCode) {
    throw new BalikovnaError("Balíkovna API nevrátila kód zásilky.");
  }
  if (parcelError) {
    throw new BalikovnaError(`Balíkovna API: ${parcelError.responseText}`);
  }

  const printResponse = header?.responsePrintParams;
  const printError = printResponse?.printParamsResponse?.find((s) => s.responseCode !== 1);
  if (printError) {
    throw new BalikovnaError(`Balíkovna API (tisk štítku): ${printError.responseText}`);
  }
  const labelBase64 = printResponse?.file;
  if (!labelBase64) {
    throw new BalikovnaError("Balíkovna API nevrátila štítek.");
  }

  return { parcelCode: parcel.parcelCode, labelPdf: Buffer.from(labelBase64, "base64") };
}
