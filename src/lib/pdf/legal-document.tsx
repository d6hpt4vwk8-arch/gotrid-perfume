import "./register-fonts";
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { PdfBlock } from "./legal-html";

const styles = StyleSheet.create({
  page: { paddingTop: 44, paddingBottom: 52, paddingHorizontal: 48, fontSize: 9.5, fontFamily: "Noto Sans", lineHeight: 1.5, color: "#131110" },
  docTitle: { fontSize: 18, fontWeight: 700, marginBottom: 4 },
  meta: { fontSize: 8, color: "#8a857e", marginBottom: 16 },
  h1: { fontSize: 15, fontWeight: 700, marginTop: 6, marginBottom: 8 },
  h2: { fontSize: 11.5, fontWeight: 700, marginTop: 14, marginBottom: 5 },
  h3: { fontSize: 10, fontWeight: 700, marginTop: 8, marginBottom: 3 },
  p: { marginBottom: 6 },
  li: { flexDirection: "row", marginBottom: 3, paddingLeft: 10 },
  bullet: { width: 14 },
  footer: { position: "absolute", bottom: 24, left: 48, right: 48, fontSize: 8, color: "#8a857e", flexDirection: "row", justifyContent: "space-between" },
});

export type LegalSection = { title: string; blocks: PdfBlock[] };

// Each section starts on a new page. The page's own <h1> is dropped from the
// blocks (the section title replaces it) so titles are not printed twice.
export function LegalPdfDocument({ title, sellerLine, sections }: { title: string; sellerLine: string; sections: LegalSection[] }) {
  return (
    <Document title={title}>
      {sections.map((section, si) => (
        <Page key={si} size="A4" style={styles.page} wrap>
          {si === 0 && <Text style={styles.meta}>{sellerLine}</Text>}
          <Text style={styles.docTitle}>{section.title}</Text>
          {section.blocks
            .filter((b) => b.type !== "h1")
            .map((b, i) =>
              b.type === "li" ? (
                <View key={i} style={styles.li} wrap={false}>
                  <Text style={styles.bullet}>{b.ordinal}</Text>
                  <Text style={{ flex: 1 }}>{b.runs.map((r, k) => (r.bold ? <Text key={k} style={{ fontWeight: 700 }}>{r.text}</Text> : r.text))}</Text>
                </View>
              ) : (
                <Text key={i} style={styles[b.type]}>
                  {b.runs.map((r, k) => (r.bold && b.type === "p" ? <Text key={k} style={{ fontWeight: 700 }}>{r.text}</Text> : r.text))}
                </Text>
              ),
            )}
          <View style={styles.footer} fixed>
            <Text>{title}</Text>
            <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
          </View>
        </Page>
      ))}
    </Document>
  );
}
