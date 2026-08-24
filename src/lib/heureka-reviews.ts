import { XMLParser } from "fast-xml-parser";

export type HeurekaReview = {
  id: string;
  rating: number;
  recommends: boolean;
  text: string;
  date: Date;
};

type RawReview = {
  rating_id: string | number;
  total_rating: string | number;
  recommends: string | number;
  unix_timestamp: string | number;
  pros?: string;
  cons?: string;
  summary?: string;
};

export async function getHeurekaShopReviews(limit = 6): Promise<HeurekaReview[]> {
  const key = process.env.HEUREKA_OVERENO_API_KEY;
  if (!key) {
    console.error("Heureka reviews: HEUREKA_OVERENO_API_KEY is not set");
    return [];
  }

  try {
    const res = await fetch(`https://www.heureka.cz/direct/dotaznik/export-review.php?key=${key}`, {
      // Heureka regenerates this export every 6 hours — no point polling faster.
      next: { revalidate: 21600 },
    });
    if (!res.ok) {
      console.error("Heureka reviews export failed:", res.status, await res.text());
      return [];
    }

    const xml = await res.text();
    const parsed = new XMLParser().parse(xml) as { reviews?: { review?: RawReview | RawReview[] } };
    const raw = parsed.reviews?.review;
    const reviews = raw ? (Array.isArray(raw) ? raw : [raw]) : [];

    return reviews
      .map((r) => ({
        id: String(r.rating_id),
        rating: Number(r.total_rating),
        recommends: Number(r.recommends) === 1,
        text: [r.pros, r.summary, r.cons].filter(Boolean).join(" "),
        date: new Date(Number(r.unix_timestamp) * 1000),
      }))
      .filter((r) => r.text)
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .slice(0, limit);
  } catch (err) {
    console.error("Heureka reviews export threw:", err);
    return [];
  }
}
