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
const POST_CODE = "13000"; // PSČ podací pošty — post office counter (Praha 3, Olšanská 38/9)
const PARCEL_PREFIX = "NB"; // Balíkovna/Box parcel type — "BA" (the YAML's generic example value) is wrong here and produces INVALID_LOCATION regardless of address.
// The account's registered podací místo for post-office counter drop-off —
// required in every parcelServiceHeaderCom or every call fails with
// responseCode 11 "INVALID_LOCATION", no matter what else is right.
const LOCATION_NUMBER = 1;

// Second podací místo added 02.09.2026 (Seznam provozoven k Dohodě 2026/00278)
// under the same CUSTOMER_ID — an "interní podací místo" with no street
// address, letting the parcel be handed over at ANY AlzaBox or partner
// Balíkovna point instead of the fixed Praha 3 counter (+10 Kč surcharge per
// Česká pošta's confirmation email). locationNumber for this PSČ hasn't been
// confirmed by Česká pošta — 1 is a guess (first/only location registered
// under this postCode); if a real call fails with responseCode 11
// INVALID_LOCATION, that's the first thing to check with them.
const PARTNER_POST_CODE = "79999";
const PARTNER_LOCATION_NUMBER = 1;

// B2B-POZRService ("Balíkovna Retail" / PORZ) — a separate nAPI service from
// ZSKService above. Unlike parcelService/createParcel, sendData carries no
// locationNumber/postCode at all: instead of being tied to one pre-registered
// podací místo (which above is fixed to post-office drop-off), each request
// declares the Sender inline, and the resulting confirmCode ("podací kód")
// can be handed over at ANY Balíkovna point/Z-BOX — that's the whole point
// of "Retail". Spec: B2B-POZRService OpenAPI 1.7.2, downloaded from
// postaonline.cz/dokumentaceapi/b2b/pozr (requires the B2B-POZR role on the
// account — as of writing this account only has SPB2B_uzivatel,
// B2B-CIS_zasilka, B2B-ZSK_zasilky, i.e. NOT YET enabled; ask Česká pošta's
// account manager to add it before this code path can work).
const POZR_API_URL = "https://b2b.postaonline.cz:444/restservices/POZRService/v1";

// Sender block for every sendData call — Gotrid Perfume's own contact/pickup
// details (not order-specific), matching PICKUP_ADDRESS in src/lib/shipping.ts.
const RETAIL_SENDER = {
  firstName: "Pavlo",
  name: "Hrytsan",
  zipCode: POST_CODE,
  mobilNumber: "735583527",
  emailAddress: "pavlohrytsan@gmail.com",
  note: "Gotrid Perfume",
};

// ConsignmentParams.trnCode/idTrnCountry identify the specific product
// (e.g. "Balíkovna"/Box) within sendData — unlike prefixParcelCode "NB"
// above, the OpenAPI spec gives no fixed value for these (its examples are
// generic placeholders "ABC"/1), and no public price list enumerates them
// either. Get the correct pair from Česká pošta's account manager together
// with enabling the B2B-POZR role, then set these two env vars — deliberately
// not hardcoded so a wrong guess can't silently mis-tag every shipment.
function requirePozrEnv(name: "BALIKOVNA_POZR_TRN_CODE" | "BALIKOVNA_POZR_ID_TRN_COUNTRY"): string {
  const value = process.env[name];
  if (!value) {
    throw new BalikovnaError(
      `${name} není nastavené — vyžádejte si od obchodního zástupce České pošty spolu s ` +
        `aktivací role B2B-POZR správnou hodnotu trnCode/idTrnCountry pro produkt Balíkovna.`,
    );
  }
  return value;
}

// service code for "Dobírka" (cash on delivery) within POZR's Services
// array — the OpenAPI spec's example ("41") is a generic placeholder for
// *some* service, not confirmed as COD; verify with Česká pošta before
// relying on it for orders paid by cash on delivery.
function requirePozrCodServiceCode(): string {
  const value = process.env.BALIKOVNA_POZR_COD_SERVICE_CODE;
  if (!value) {
    throw new BalikovnaError(
      "BALIKOVNA_POZR_COD_SERVICE_CODE není nastavené — vyžádejte si od České pošty kód " +
        "doplňkové služby „Dobírka“ pro sendData/POZR (není totéž co „Du“ u ZSKService).",
    );
  }
  return value;
}

// Unlike ZSKService (which settles COD to a bank account already on file
// for customerID, nothing extra in the request), POZR's CodAccount object
// requires the account explicitly on every call — do not reuse BANK_IBAN
// (that's the QR-platba IBAN, not necessarily confirmed as the same account
// or in this accountPrefix/account/bankCode split format) without checking
// with Česká pošta first.
function requirePozrCodAccount(): { accountPrefix: string; account: string; bankCode: string } {
  const account = process.env.BALIKOVNA_POZR_COD_ACCOUNT;
  const bankCode = process.env.BALIKOVNA_POZR_COD_BANK_CODE;
  if (!account || !bankCode) {
    throw new BalikovnaError(
      "BALIKOVNA_POZR_COD_ACCOUNT / BALIKOVNA_POZR_COD_BANK_CODE nejsou nastavené — doplňte " +
        "číslo účtu pro vyplácení dobírek přes sendData/POZR.",
    );
  }
  return { accountPrefix: process.env.BALIKOVNA_POZR_COD_ACCOUNT_PREFIX ?? "", account, bankCode };
}

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
  // Where WE (the sender) hand the parcel over — not to be confused with
  // pickupPointId above (where the RECIPIENT collects it). "post_office"
  // (default) requires a trip to the one registered post-office counter;
  // "partner_network" lets the label be dropped at any AlzaBox/partner
  // Balíkovna point instead, for a +10 Kč surcharge billed by Česká pošta.
  dropOff?: "post_office" | "partner_network";
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
  const usePartnerNetwork = input.dropOff === "partner_network";
  const body = {
    parcelServiceHeader: {
      parcelServiceHeaderCom: {
        transmissionDate: new Date().toISOString().slice(0, 10),
        customerID: CUSTOMER_ID,
        postCode: usePartnerNetwork ? PARTNER_POST_CODE : POST_CODE,
        locationNumber: usePartnerNetwork ? PARTNER_LOCATION_NUMBER : LOCATION_NUMBER,
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

type ParcelPrintingResponse = {
  printingHeaderResult?: {
    printingStatusResponse?: { responseCode: number; responseText: string };
  };
  printingDataResult?: string; // base64 PDF
};

/**
 * Re-fetches the address label PDF for a parcel that was already created
 * (i.e. has a stored parcelCode) — the /parcelService createParcel operation
 * always makes a NEW shipment, so it can't be used again here. This is the
 * nAPI's dedicated reprint operation (/parcelPrinting, confirmed against the
 * official OpenAPI spec at postaonline.cz/dokumentaceapi/b2b/zsk).
 */
export async function reprintLabel(parcelCode: string): Promise<Buffer> {
  const body = {
    printingHeader: { customerID: CUSTOMER_ID, idForm: 101, shiftHorizontal: 0, shiftVertical: 0 },
    printingData: [parcelCode],
  };
  const bodyJson = JSON.stringify(body);

  let res: Awaited<ReturnType<typeof undiciFetch>>;
  try {
    res = await undiciFetch(`${API_URL}/parcelPrinting`, {
      method: "POST",
      headers: buildAuthHeaders(bodyJson),
      body: bodyJson,
      dispatcher: balikovnaDispatcher,
    });
  } catch (err) {
    const cause = err instanceof Error ? err.cause : undefined;
    console.error("Balíkovna reprint request failed:", err, "cause:", cause);
    const detail = cause instanceof Error ? cause.message : err instanceof Error ? err.message : String(err);
    throw new BalikovnaError(`Balíkovna API — chyba spojení: ${detail}`);
  }

  const rawText = await res.text();
  if (!res.ok) {
    console.error("Balíkovna reprint non-OK response:", res.status, rawText);
    throw new BalikovnaError(`Balíkovna API vrátila HTTP ${res.status}: ${rawText}`);
  }

  let parsed: ParcelPrintingResponse;
  try {
    parsed = JSON.parse(rawText) as ParcelPrintingResponse;
  } catch {
    console.error("Balíkovna reprint returned non-JSON body:", rawText);
    throw new BalikovnaError(`Balíkovna API vrátila neplatnou odpověď: ${rawText.slice(0, 500)}`);
  }

  const status = parsed.printingHeaderResult?.printingStatusResponse;
  if (status && status.responseCode !== 1) {
    console.error("Balíkovna reprint error response:", rawText);
    throw new BalikovnaError(`Balíkovna API (opětovný tisk): ${status.responseText}`);
  }
  if (!parsed.printingDataResult) {
    throw new BalikovnaError("Balíkovna API nevrátila štítek.");
  }

  return Buffer.from(parsed.printingDataResult, "base64");
}

async function pozrFetch(path: string, init: { method: "GET" | "POST"; body?: string }) {
  const bodyJson = init.body ?? "";
  const headers = {
    ...buildAuthHeaders(bodyJson),
    customerID: CUSTOMER_ID,
  };
  try {
    return await undiciFetch(`${POZR_API_URL}${path}`, {
      method: init.method,
      headers,
      ...(init.body ? { body: init.body } : {}),
      dispatcher: balikovnaDispatcher,
    });
  } catch (err) {
    const cause = err instanceof Error ? err.cause : undefined;
    console.error("Balíkovna POZR request failed:", path, err, "cause:", cause);
    const detail = cause instanceof Error ? cause.message : err instanceof Error ? err.message : String(err);
    throw new BalikovnaError(`Balíkovna API (POZR) — chyba spojení: ${detail}`);
  }
}

export type CreateRetailParcelInput = {
  weightKg: number; // not sent to POZR (ConsignmentParams has no weight field —
  // the drop-off point weighs the parcel itself), kept for callers that log/store it
  codAmount: number | null;
  recipient: {
    firstName: string;
    surname: string;
    mobilNumber?: string;
    emailAddress: string;
  };
  // BalikovnaPoint.id, same convention as ZSKService's createParcel: for a
  // point/Box delivery the point's ID goes in the address's zipCode field.
  pickupPointId: string;
};

/**
 * Balíkovna Retail (PORZ) equivalent of createParcel — submits the shipment
 * via the /sendData operation (async: POST returns an idTransaction, then we
 * poll GET .../idTransaction/{id} until it resolves) and returns the
 * confirmCode ("podací kód") the sender hands over at ANY Balíkovna point,
 * plus the parcelCode (ConsignmentCode) for tracking/label lookup. Requires
 * the B2B-POZR role and BALIKOVNA_POZR_TRN_CODE/BALIKOVNA_POZR_ID_TRN_COUNTRY
 * (and BALIKOVNA_POZR_COD_SERVICE_CODE for COD orders) — see the comments
 * above POZR_API_URL.
 */
export async function createRetailParcel(
  input: CreateRetailParcelInput,
): Promise<{ confirmCode: string; parcelCode: string }> {
  const trnCode = requirePozrEnv("BALIKOVNA_POZR_TRN_CODE");
  const idTrnCountry = Number(requirePozrEnv("BALIKOVNA_POZR_ID_TRN_COUNTRY"));

  const body = {
    SendData: {
      Sender: RETAIL_SENDER,
      ...(input.codAmount ? { CodAccount: requirePozrCodAccount() } : {}),
      ConsignmentParams: [
        {
          prefix: PARCEL_PREFIX,
          trnCode,
          idTrnCountry,
          ...(input.codAmount ? { amount: input.codAmount } : {}),
          ...(input.codAmount ? { Services: [{ service: requirePozrCodServiceCode() }] } : {}),
          Addressee: {
            firstName: input.recipient.firstName,
            name: input.recipient.surname,
            zipCode: input.pickupPointId,
            gsm: input.recipient.mobilNumber ?? "",
            email: input.recipient.emailAddress,
          },
        },
      ],
    },
  };

  const bodyJson = JSON.stringify(body);
  const postRes = await pozrFetch("/sendData", { method: "POST", body: bodyJson });
  const postText = await postRes.text();
  if (!postRes.ok) {
    console.error("Balíkovna POZR sendData non-OK response:", postRes.status, postText, "body:", bodyJson);
    throw new BalikovnaError(`Balíkovna API (POZR) vrátila HTTP ${postRes.status}: ${postText}`);
  }

  let posted: { idTransaction?: string };
  try {
    posted = JSON.parse(postText) as { idTransaction?: string };
  } catch {
    throw new BalikovnaError(`Balíkovna API (POZR) vrátila neplatnou odpověď: ${postText.slice(0, 500)}`);
  }
  if (!posted.idTransaction) {
    throw new BalikovnaError("Balíkovna API (POZR) nevrátila idTransaction.");
  }

  // /sendData is asynchronous — poll for the result. The spec gives no SLA,
  // so retry with a short fixed delay for up to ~30s before giving up.
  const maxAttempts = 15;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const getRes = await pozrFetch(`/sendData/idTransaction/${posted.idTransaction}`, { method: "GET" });
    if (getRes.status === 202) continue; // still processing

    const getText = await getRes.text();
    if (!getRes.ok) {
      console.error("Balíkovna POZR poll non-OK response:", getRes.status, getText);
      throw new BalikovnaError(`Balíkovna API (POZR) vrátila HTTP ${getRes.status}: ${getText}`);
    }

    let result: { confirmCode?: string; ConsignmentCode?: string };
    try {
      result = JSON.parse(getText) as { confirmCode?: string; ConsignmentCode?: string };
    } catch {
      throw new BalikovnaError(`Balíkovna API (POZR) vrátila neplatnou odpověď: ${getText.slice(0, 500)}`);
    }
    if (!result.confirmCode || !result.ConsignmentCode) {
      throw new BalikovnaError("Balíkovna API (POZR) nevrátila podací kód nebo ID zásilky.");
    }
    return { confirmCode: result.confirmCode, parcelCode: result.ConsignmentCode };
  }

  throw new BalikovnaError(
    "Balíkovna API (POZR): zpracování zásilky trvá déle než obvykle, zkuste štítek znovu za chvíli.",
  );
}

/**
 * Fetches the printable address label PDF for a parcel already submitted via
 * createRetailParcel — optional under POZR, since the drop-off point can
 * also affix the label itself using just the confirmCode.
 */
export async function getRetailLabel(parcelCode: string): Promise<Buffer> {
  const res = await pozrFetch(`/addressLabel/consignmentCode/${parcelCode}`, { method: "GET" });
  if (!res.ok) {
    const text = await res.text();
    console.error("Balíkovna POZR addressLabel non-OK response:", res.status, text);
    throw new BalikovnaError(`Balíkovna API (POZR) vrátila HTTP ${res.status}: ${text}`);
  }
  return Buffer.from(await res.arrayBuffer());
}
