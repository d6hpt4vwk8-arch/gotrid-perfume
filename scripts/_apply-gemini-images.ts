// Replaces the photo of the listed hidden GIFT- products with the Gemini render in ops/gift-images/2026-11-gemini/.
import { copyFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
const MAP: Record<string, string> = {
  "tiger-gel": "GIFT-PALACIO-TIGER-GEL", "snake-serum": "GIFT-PALACIO-SNAKE-SERUM", "cannadream": "GIFT-CANNABELLUM-CANNADREAM",
  "cannaprotect": "GIFT-PALACIO-CANNAPROTECT", "mizon-collagen": "GIFT-MIZON-COLLAGEN", "mizon-hyalugen": "GIFT-MIZON-HYALUGEN",
  "vvbetter-teca": "GIFT-VVBETTER-TECA", "dralthea-aqua": "GIFT-DRALTHEA-AQUA", "iconique-mask": "GIFT-ICONIQUE-MASK",
  "iconique-shampoo": "GIFT-ICONIQUE-SHAMPOO", "village11-aha": "GIFT-VILLAGE11-AHA-LOTION", "scent-lyra": "GIFT-SCENT-OF-STARS-LYRA",
  "rabanne-parfum": "GIFT-RABANNE-1M-PARFUM", "rabanne-edt": "GIFT-RABANNE-1M-EDT", "skin1004-oil": "GIFT-SKIN1004-CENTELLA-OIL",
  "vvbetter-sun": "GIFT-VVBETTER-SUN", "vvbetter-eye": "GIFT-VVBETTER-EYE", "garnier-mask": "GIFT-GARNIER-HYDRA-BOMB", "curaprox-interdental": "GIFT-CURAPROX-CPS115",
};
(async () => {
  for (const name of process.argv.slice(2)) {
    const code = MAP[name];
    const prod = await p.product.findFirstOrThrow({ where: { code }, select: { id: true } });
    const dir = path.join("public", "uploads", "products", encodeURIComponent(code));
    copyFileSync(path.join("ops", "gift-images", "2026-11-gemini", `${name}.jpg`), path.join(dir, "render-1.jpg"));
    await p.productImage.deleteMany({ where: { productId: prod.id } });
    await p.productImage.create({ data: { productId: prod.id, url: `/uploads/products/${encodeURIComponent(code)}/render-1.jpg`, sortOrder: 0 } });
    console.log("updated", code);
  }
  await p.$disconnect();
})();
