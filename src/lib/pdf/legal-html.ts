import { parseDocument } from "htmlparser2";

// Turns the rendered HTML of a legal page (h1/h2/h3/p/ul/ol/li, with inline
// strong/em/a/br) into flat blocks the PDF document can lay out — so the PDF
// attachments are built from the very same page the customer reads on the
// site, not from a second copy of the text that would drift.
export type PdfRun = { text: string; bold?: boolean };
export type PdfBlock = { type: "h1" | "h2" | "h3" | "p" | "li"; runs: PdfRun[]; ordinal?: string };

type Node = { type: string; name?: string; data?: string; children?: Node[] };

function collectRuns(nodes: Node[], bold: boolean, out: PdfRun[]) {
  for (const n of nodes) {
    if (n.type === "text") {
      const text = (n.data ?? "").replace(/\s+/g, " ");
      if (text) out.push({ text, bold });
    } else if (n.type === "tag") {
      if (n.name === "br") out.push({ text: "\n", bold });
      else collectRuns(n.children ?? [], bold || n.name === "strong" || n.name === "b", out);
    }
  }
}

function trimRuns(runs: PdfRun[]): PdfRun[] {
  const merged = runs.map((r) => ({ ...r }));
  while (merged.length && !merged[0].text.trim()) merged.shift();
  while (merged.length && !merged[merged.length - 1].text.trim()) merged.pop();
  if (merged.length) {
    merged[0].text = merged[0].text.replace(/^\s+/, "");
    merged[merged.length - 1].text = merged[merged.length - 1].text.replace(/\s+$/, "");
    // "<br>" is followed by source indentation — drop spaces around line breaks.
    for (const r of merged) r.text = r.text.replace(/ *\n */g, "\n");
  }
  return merged;
}

function findFirst(nodes: Node[], name: string): Node | null {
  for (const n of nodes) {
    if (n.type === "tag" && n.name === name) return n;
    const inner = n.children ? findFirst(n.children, name) : null;
    if (inner) return inner;
  }
  return null;
}

/** `rootTag`: only read inside the first such element (the page's <main>, not the site header/footer). */
export function htmlToBlocks(html: string, rootTag?: string): PdfBlock[] {
  const doc = parseDocument(html) as unknown as Node;
  const root = rootTag ? findFirst(doc.children ?? [], rootTag) : null;
  const blocks: PdfBlock[] = [];

  const walk = (nodes: Node[]) => {
    for (const n of nodes) {
      if (n.type !== "tag") continue;
      if (n.name === "h1" || n.name === "h2" || n.name === "h3" || n.name === "p") {
        const runs: PdfRun[] = [];
        collectRuns(n.children ?? [], n.name !== "p", runs);
        const t = trimRuns(runs);
        if (t.length) blocks.push({ type: n.name as PdfBlock["type"], runs: t });
      } else if (n.name === "ul" || n.name === "ol") {
        let i = 0;
        for (const li of (n.children ?? []).filter((c) => c.type === "tag" && c.name === "li")) {
          const runs: PdfRun[] = [];
          collectRuns(li.children ?? [], false, runs);
          const t = trimRuns(runs);
          i += 1;
          if (t.length) blocks.push({ type: "li", runs: t, ordinal: n.name === "ol" ? `${i}.` : "•" });
        }
      } else if (n.children) {
        walk(n.children);
      }
    }
  };
  walk((root ?? doc).children ?? []);
  return blocks;
}
