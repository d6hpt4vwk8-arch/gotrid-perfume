// Category tree per TZ §2.1. sortOrder controls menu order; "hidden: true"
// marks branches the TZ says should not be promoted (present but low priority).

export interface CategorySeedNode {
  name: string;
  hidden?: boolean;
  children?: CategorySeedNode[];
}

export const CATEGORY_TREE: CategorySeedNode[] = [
  {
    name: "Parfémy",
    children: [
      {
        name: "Dámské parfémy",
        children: [
          { name: "Parfémované vody" },
          { name: "Toaletní vody" },
          { name: "Parfémované oleje" },
        ],
      },
      {
        name: "Pánské parfémy",
        children: [{ name: "Parfémované vody" }, { name: "Toaletní vody" }],
      },
      {
        name: "Unisex parfémy",
        children: [{ name: "Parfémované vody" }, { name: "Toaletní vody" }],
      },
    ],
  },
  {
    name: "Kosmetika",
    children: [
      { name: "Sprchové gely" },
      { name: "Tělové oleje" },
      {
        name: "Vlasy",
        children: [
          { name: "Šampony" },
          { name: "Kondicionéry a balzámy" },
          { name: "Vlasové masky" },
          { name: "Vlasová séra" },
          { name: "Vlasová tonika" },
          { name: "Styling" },
        ],
      },
      {
        name: "Pleť",
        children: [
          { name: "Čištění pleti" },
          { name: "Pleťová séra" },
          { name: "Pleťové krémy" },
          { name: "Pleťové peelingy" },
          { name: "Pleťové masky" },
          { name: "Péče o řasy a obočí" },
        ],
      },
      {
        name: "Tělo",
        children: [
          { name: "Deodoranty" },
          { name: "Tělová mléka" },
          { name: "Krém na ruce" },
          { name: "Mýdla" },
          { name: "Sprcha a koupel" },
          { name: "Opalovací kosmetika" },
          { name: "Depilace" },
        ],
      },
      {
        name: "Dekorativní kosmetika",
        children: [{ name: "Rty" }, { name: "Oči" }],
      },
    ],
  },
  {
    name: "Zuby",
    children: [
      { name: "Zubní pasty" },
      { name: "Zubní kartáčky" },
      { name: "Ústní vody" },
      { name: "Zubní nitě" },
      { name: "Doplňky k čištění zubů" },
    ],
  },
  { name: "Aroma Difuzéry" },
  { name: "Vonné svíčky" },
  { name: "Vůně do auta" },
  // TZ §2.1: second-tier category, kept at the bottom of the menu, not promoted —
  // still visible, just last in sortOrder (not `hidden`, which fully hides a category).
  { name: "Domácnost" },
  { name: "Péče o zdraví" },
  { name: "Výprodej" },
];

export const SEED_BRANDS = [
  "Lattafa",
  "OGX",
  "The Humble Co.",
  "Nivea",
  "Dermacol",
  "Freeman",
  "Eyfel Perfume",
  "Hugo Boss",
  "Jean Paul Gaultier",
  "Mugler",
  "Nama Fiji",
];
