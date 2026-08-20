import type { Prisma } from "@prisma/client";

interface ScentNote {
  name: string;
  imageUrl: string;
}

interface MainAccord {
  name: string;
  intensity: string | null;
}

function asNotes(value: Prisma.JsonValue): ScentNote[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (n): n is Prisma.JsonObject => typeof n === "object" && n !== null && "name" in n && "imageUrl" in n,
  ) as unknown as ScentNote[];
}

function asAccords(value: Prisma.JsonValue | null): MainAccord[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (a): a is Prisma.JsonObject => typeof a === "object" && a !== null && "name" in a,
  ) as unknown as MainAccord[];
}

const ACCORD_WIDTH: Record<string, string> = {
  Dominant: "100%",
  Prominent: "70%",
  Moderate: "45%",
  Light: "25%",
};

function NoteTier({ label, notes }: { label: string; notes: ScentNote[] }) {
  if (notes.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      <span className="text-[11px] font-semibold tracking-wide text-accent-2 uppercase">{label}</span>
      <div className="flex flex-wrap gap-4">
        {notes.map((note) => (
          <div key={note.name} className="flex w-16 flex-col items-center gap-1.5 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-line bg-line/20 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={note.imageUrl} alt={note.name} className="h-full w-full object-contain" loading="lazy" />
            </div>
            <span className="text-xs leading-tight text-ink">{note.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ScentNotesPyramid({
  topNotes,
  middleNotes,
  baseNotes,
  mainAccords,
}: {
  topNotes: Prisma.JsonValue;
  middleNotes: Prisma.JsonValue;
  baseNotes: Prisma.JsonValue;
  mainAccords: Prisma.JsonValue | null;
}) {
  const top = asNotes(topNotes);
  const middle = asNotes(middleNotes);
  const base = asNotes(baseNotes);
  const accords = asAccords(mainAccords).slice(0, 6);

  if (top.length === 0 && middle.length === 0 && base.length === 0) return null;

  return (
    <section className="border-t border-line pt-6">
      <h2 className="mb-5 text-lg font-bold text-ink">Vůňová pyramida</h2>
      <div className="flex flex-col gap-6">
        <NoteTier label="Vrcholové tóny" notes={top} />
        <NoteTier label="Srdce vůně" notes={middle} />
        <NoteTier label="Základní tóny" notes={base} />
      </div>

      {accords.length > 0 && (
        <div className="mt-6 flex flex-col gap-2 border-t border-line pt-5">
          <span className="text-[11px] font-semibold tracking-wide text-accent-2 uppercase">
            Charakter vůně
          </span>
          <ul className="flex flex-col gap-1.5">
            {accords.map((accord) => (
              <li key={accord.name} className="flex items-center gap-3">
                <span className="w-28 shrink-0 text-sm text-ink capitalize">{accord.name}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line/40">
                  <span
                    className="block h-full rounded-full bg-accent"
                    style={{ width: accord.intensity ? (ACCORD_WIDTH[accord.intensity] ?? "35%") : "35%" }}
                  />
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
