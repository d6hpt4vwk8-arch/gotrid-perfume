import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

interface ScentNote {
  name: string;
  imageUrl: string;
}

interface MainAccord {
  name: string;
  intensity: string | null;
}

interface NotePhoto {
  imageUrl: string;
  attributionName: string | null;
  attributionUrl: string | null;
}

function asNotes(value: Prisma.JsonValue): ScentNote[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (n): n is Prisma.JsonObject => typeof n === "object" && n !== null && "name" in n,
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

// Real ingredient photos per note name (mrrizz.cz-style), shared across all
// products — "Vanilla" looks the same regardless of which fragrance it's in.
async function getNotePhotos(noteNames: string[]): Promise<Map<string, NotePhoto>> {
  if (noteNames.length === 0) return new Map();
  const rows = await prisma.scentNotePhoto.findMany({
    where: { noteName: { in: [...new Set(noteNames.map((n) => n.toLowerCase()))] } },
  });
  return new Map(rows.map((r) => [r.noteName, r]));
}

function NoteTier({
  label,
  notes,
  photos,
}: {
  label: string;
  notes: ScentNote[];
  photos: Map<string, NotePhoto>;
}) {
  if (notes.length === 0) return null;
  return (
    <div className="flex flex-col gap-3">
      <span className="text-[11px] font-semibold tracking-wide text-accent-2 uppercase">{label}</span>
      <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5">
        {notes.map((note) => {
          const photo = photos.get(note.name.toLowerCase());
          return (
            <div key={note.name} className="flex flex-col items-center gap-2 text-center">
              <div className="aspect-square w-full overflow-hidden rounded-lg bg-line/20">
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photo.imageUrl}
                    alt={note.name}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl text-accent-2/40">
                    ?
                  </div>
                )}
              </div>
              <span className="text-xs leading-tight text-ink">{note.name}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export async function ScentNotesPyramid({
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

  const photos = await getNotePhotos([...top, ...middle, ...base].map((n) => n.name));
  const usedPhotographers = [...new Map(
    [...photos.values()]
      .filter((p) => p.attributionName && p.attributionUrl)
      .map((p) => [p.attributionName, p.attributionUrl] as const),
  )];

  return (
    <section className="border-t border-line pt-6">
      <h2 className="mb-5 text-lg font-bold text-ink">Vůňová pyramida</h2>
      <div className="flex flex-col gap-6">
        <NoteTier label="Vrchní tóny" notes={top} photos={photos} />
        <NoteTier label="Srdcové tóny" notes={middle} photos={photos} />
        <NoteTier label="Základní tóny" notes={base} photos={photos} />
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

      {usedPhotographers.length > 0 && (
        <p className="mt-4 text-[11px] text-accent-2">
          Fotografie:{" "}
          {usedPhotographers.map(([name, url], i) => (
            <span key={name}>
              <a href={url ?? undefined} target="_blank" rel="noopener noreferrer" className="underline">
                {name}
              </a>
              {i < usedPhotographers.length - 1 ? ", " : ""}
            </span>
          ))}{" "}
          přes{" "}
          <a
            href="https://unsplash.com/?utm_source=gotrid-perfume&utm_medium=referral"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Unsplash
          </a>
        </p>
      )}
    </section>
  );
}
