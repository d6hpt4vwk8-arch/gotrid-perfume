"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { BarcodeFormat, DecodeHintType } from "@zxing/library";
import { lookupEan, receiveStock, type ReceivingMatch, type ReceivingResult } from "@/lib/admin/actions/receiving";

interface Line {
  ean: string;
  qty: number;
  // null while the catalog lookup is still running
  matches: ReceivingMatch[] | null;
  productId: string | null;
}

// Shorter than a typical re-aim of the phone, so one pass over a barcode counts once while a deliberate second
// scan of the same box adds another unit.
const SAME_CODE_COOLDOWN_MS = 1500;

function feedback() {
  try {
    navigator.vibrate?.(60);
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    osc.frequency.value = 1100;
    osc.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
    setTimeout(() => void ctx.close(), 200);
  } catch {
    // vibration/sound are only a convenience
  }
}

// Receiving goods onto our own shelf: scan each box (or type an EAN), the count goes up per scan, then one
// click writes everything to ownStock. EANs missing from the catalog are parked in the activity log.
export function ReceivingScanner() {
  const [lines, setLines] = useState<Line[]>([]);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [result, setResult] = useState<ReceivingResult | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const videoRef = useRef<HTMLVideoElement>(null);
  const lastScan = useRef({ code: "", at: 0 });
  const looked = useRef(new Set<string>());

  const addCode = useCallback((raw: string) => {
    const code = raw.replace(/\D/g, "");
    if (code.length < 8) return;
    const now = Date.now();
    if (lastScan.current.code === code && now - lastScan.current.at < SAME_CODE_COOLDOWN_MS) return;
    lastScan.current = { code, at: now };
    feedback();
    setResult(null);

    setLines((prev) => {
      const i = prev.findIndex((l) => l.ean === code);
      if (i >= 0) return prev.map((l, idx) => (idx === i ? { ...l, qty: l.qty + 1 } : l));
      return [{ ean: code, qty: 1, matches: null, productId: null }, ...prev];
    });

    if (!looked.current.has(code)) {
      looked.current.add(code);
      lookupEan(code)
        .then((matches) =>
          setLines((prev) =>
            prev.map((l) => (l.ean === code ? { ...l, matches, productId: matches[0]?.id ?? null } : l)),
          ),
        )
        .catch(() => {
          looked.current.delete(code);
          setLines((prev) => prev.map((l) => (l.ean === code ? { ...l, matches: [], productId: null } : l)));
        });
    }
  }, []);

  useEffect(() => {
    if (!cameraOn || !videoRef.current) return;
    let stopped = false;
    let stop: (() => void) | undefined;

    const hints = new Map<DecodeHintType, unknown>([
      [DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.EAN_13, BarcodeFormat.EAN_8, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E]],
      [DecodeHintType.TRY_HARDER, true],
    ]);
    const reader = new BrowserMultiFormatReader(hints, { delayBetweenScanAttempts: 120, delayBetweenScanSuccess: 600 });

    reader
      .decodeFromConstraints({ video: { facingMode: { ideal: "environment" } }, audio: false }, videoRef.current, (res) => {
        if (res) addCode(res.getText());
      })
      .then((controls) => {
        if (stopped) controls.stop();
        else stop = () => controls.stop();
      })
      .catch((err: unknown) => {
        setCameraError(
          err instanceof Error && err.name === "NotAllowedError"
            ? "Prohlížeč nemá povolený přístup ke kameře."
            : "Kameru se nepodařilo spustit.",
        );
        setCameraOn(false);
      });

    return () => {
      stopped = true;
      stop?.();
    };
  }, [cameraOn, addCode]);

  function setQty(ean: string, qty: number) {
    setLines((prev) => prev.map((l) => (l.ean === ean ? { ...l, qty: Math.max(1, Math.min(10_000, qty || 1)) } : l)));
  }

  function removeLine(ean: string) {
    looked.current.delete(ean);
    setLines((prev) => prev.filter((l) => l.ean !== ean));
  }

  function save() {
    setSaveError(null);
    startTransition(async () => {
      try {
        const res = await receiveStock(lines.map((l) => ({ ean: l.ean, productId: l.productId, qty: l.qty })));
        setResult(res);
        setLines([]);
        looked.current.clear();
      } catch {
        setSaveError("Zápis se nepodařil, zkuste to prosím znovu.");
      }
    });
  }

  const totalUnits = lines.reduce((sum, l) => sum + l.qty, 0);
  const loading = lines.some((l) => l.matches === null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-sm border border-line bg-white p-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setCameraError(null);
              setCameraOn((on) => !on);
            }}
            className="rounded-sm bg-ink px-4 py-2 text-sm font-semibold text-white"
          >
            {cameraOn ? "Zastavit kameru" : "Spustit kameru"}
          </button>
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              addCode(manual);
              setManual("");
            }}
          >
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              inputMode="numeric"
              placeholder="EAN ručně"
              className="w-44 rounded-sm border border-line px-3 py-2 text-sm"
            />
            <button type="submit" className="rounded-sm border border-line px-3 py-2 text-sm font-semibold">
              Přidat
            </button>
          </form>
        </div>
        {cameraError && <p className="text-sm text-red-600">{cameraError}</p>}
        {cameraOn && (
          <video
            ref={videoRef}
            playsInline
            muted
            className="aspect-[4/3] w-full max-w-md rounded-sm bg-black object-cover"
          />
        )}
        {cameraOn && (
          <p className="text-xs text-accent-2">
            Namiřte kameru na čárový kód. Každé načtení přidá 1 ks, stejný kód znovu až po pauze ~1,5 s.
          </p>
        )}
      </div>

      {result && (
        <div className="rounded-sm border border-line bg-white p-4 text-sm">
          <span className="font-semibold text-ok">Zapsáno:</span> {result.receivedUnits} ks u {result.receivedProducts} produktů
          {result.unknownEans > 0 && (
            <span className="text-accent-2">
              {" "}
              · {result.unknownEans} neznámých EAN uloženo do seznamu níže
            </span>
          )}
        </div>
      )}

      {lines.length > 0 && (
        <div className="flex flex-col gap-2">
          {lines.map((line) => {
            const chosen = line.matches?.find((m) => m.id === line.productId) ?? null;
            return (
              <div key={line.ean} className="flex flex-wrap items-center gap-3 rounded-sm border border-line bg-white p-3">
                {chosen?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={chosen.image} alt="" className="h-14 w-14 shrink-0 rounded-sm object-cover" />
                ) : (
                  <div className="h-14 w-14 shrink-0 rounded-sm bg-line" />
                )}
                <div className="min-w-0 flex-1 basis-48">
                  {line.matches === null ? (
                    <div className="text-sm text-accent-2">Hledám produkt…</div>
                  ) : chosen ? (
                    <>
                      <div className="truncate text-sm font-medium">{chosen.name}</div>
                      <div className="text-xs text-accent-2">
                        {chosen.brand ? `${chosen.brand} · ` : ""}na skladě u nás {chosen.ownStock} ks
                        {!chosen.visible && " · skrytý"}
                      </div>
                    </>
                  ) : (
                    <div className="text-sm font-medium text-amber-700">Neznámý EAN — uloží se do seznamu k doplnění</div>
                  )}
                  <div className="font-mono text-xs text-accent-2">{line.ean}</div>
                  {line.matches && line.matches.length > 1 && (
                    <select
                      value={line.productId ?? ""}
                      onChange={(e) =>
                        setLines((prev) => prev.map((l) => (l.ean === line.ean ? { ...l, productId: e.target.value } : l)))
                      }
                      className="mt-1 max-w-full rounded-sm border border-line px-2 py-1 text-xs"
                    >
                      {line.matches.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.ownStock} ks{m.visible ? "" : ", skrytý"})
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setQty(line.ean, line.qty - 1)}
                    className="h-9 w-9 rounded-sm border border-line text-lg leading-none"
                    aria-label="Ubrat kus"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    min={1}
                    value={line.qty}
                    onChange={(e) => setQty(line.ean, Number(e.target.value))}
                    className="h-9 w-16 rounded-sm border border-line text-center text-sm font-semibold"
                  />
                  <button
                    type="button"
                    onClick={() => setQty(line.ean, line.qty + 1)}
                    className="h-9 w-9 rounded-sm border border-line text-lg leading-none"
                    aria-label="Přidat kus"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => removeLine(line.ean)}
                    className="ml-1 h-9 w-9 rounded-sm text-lg leading-none text-accent-2 hover:text-red-600"
                    aria-label="Odebrat řádek"
                  >
                    ×
                  </button>
                </div>
              </div>
            );
          })}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={isPending || loading}
              className="rounded-sm bg-ink px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {isPending ? "Zapisuji…" : `Zapsat na sklad (${totalUnits} ks)`}
            </button>
            <button
              type="button"
              onClick={() => {
                setLines([]);
                looked.current.clear();
              }}
              disabled={isPending}
              className="rounded-sm border border-line px-4 py-2.5 text-sm"
            >
              Zahodit vše
            </button>
            {saveError && <span className="text-sm text-red-600">{saveError}</span>}
          </div>
        </div>
      )}
    </div>
  );
}
