// Labels for the cosmetics filters "Druh produktu" (Product.productType) and "Složka" (Product.keyIngredients).
// The values themselves are assigned by scripts/backfill-cosmetics-filters.ts.
export const PRODUCT_TYPE_LABELS: Record<string, string> = {
  cisteni: "Čištění a odličování",
  tonika: "Tonika a esence",
  sera: "Séra a ampule",
  kremy: "Krémy a hydratace",
  oci: "Péče o oči",
  masky: "Masky a náplasti",
  slunce: "Opalovací přípravky",
  peeling: "Peelingy a exfoliace",
  vlasy: "Péče o vlasy",
  makeup: "Make-up (BB krémy)",
  sady: "Sady a ostatní",
};

export const INGREDIENT_LABELS: Record<string, string> = {
  centella: "Centella asijská",
  propolis: "Propolis",
  niacinamid: "Niacinamid",
  retinol: "Retinol a retinoidy",
  hyaluron: "Kyselina hyaluronová",
  peptidy: "Peptidy",
  hlemyzdi: "Hlemýždí mucin",
  zensen: "Ženšen",
  ryze: "Rýže",
  "zeleny-caj": "Zelený čaj",
  "vitamin-c": "Vitamin C",
  pdrn: "PDRN",
  kyseliny: "AHA / BHA kyseliny",
  kolagen: "Kolagen",
  ceramidy: "Ceramidy",
  aloe: "Aloe vera",
};
