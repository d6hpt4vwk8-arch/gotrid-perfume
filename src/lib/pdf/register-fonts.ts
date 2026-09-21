import path from "node:path";
import { Font } from "@react-pdf/renderer";

// The base-14 PDF fonts (Helvetica etc.) only support WinAnsi encoding and
// silently drop Czech diacritics (č, ř, ě, ů, ž…) — Noto Sans is embedded so
// generated PDFs actually render Czech text correctly.
// Fonts live under /public (not imported statically) so Vercel's serverless
// file tracing always ships them — a path under src/ read only via fs at
// runtime could be silently dropped from the deployed function bundle.
//
// Shared by every PDF document (faktura.tsx, dobropis.tsx, ...) via a plain
// side-effect import — Font.register keys by family name, so having two
// documents each call it themselves would just double-register "Noto Sans".
Font.register({
  family: "Noto Sans",
  fonts: [
    { src: path.join(process.cwd(), "public/fonts/NotoSans-Regular.ttf") },
    {
      src: path.join(process.cwd(), "public/fonts/NotoSans-Bold.ttf"),
      fontWeight: 700,
    },
  ],
});
