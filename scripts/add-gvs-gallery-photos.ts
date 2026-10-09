// Extra gallery photos for GVS Cosmetics products (owner request 2026-10-09: one
// photo per product made the shop look "empty" next to competitors). Sources:
// kosmosbeauty.com (CP-1 / Dr. Althea masks and essences), vvbetter.com (VVBETTER),
// doctoraltheaglobal.com — all >= 1000 px. Picked by eye from contact sheets:
// text-free lifestyle / texture / in-hand shots only; infographics with English
// copy, clinical before/after charts, shop watermarks, plain pack shots that
// duplicate the main photo, and images of a different pack size were left out.
// Appended after the existing main photo (sortOrder 1, 2, ...), re-encoded as
// JPEG q88 at <= 1400 px. Idempotent: products that already have extra photos
// are skipped unless --force.
//
// Usage: npx tsx scripts/add-gvs-gallery-photos.ts --dry-run | (no flag = apply)
import { randomBytes } from "node:crypto";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { prisma } from "../src/lib/prisma";

const DRY_RUN = process.argv.includes("--dry-run");
const FORCE = process.argv.includes("--force");
const MAX_EDGE = 1400;

const PLAN: { code: string; urls: string[] }[] = [
  { code: "GVS-10179", urls: ["https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2025-09-05T143858.551.png?v=1757072405", "https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2025-09-05T143923.517.png?v=1757072405"] },
  { code: "GVS-10230", urls: ["https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2026-01-16T160816.746.png?v=1768572670", "https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2026-01-16T160219.699.png?v=1768572670"] },
  { code: "GVS-10582", urls: ["https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2025-09-10T141652.243.png?v=1757503152"] },
  { code: "GVS-10933", urls: ["https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2025-04-03T150027.604.png?v=1743681708"] },
  { code: "GVS-11022", urls: ["https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2025-09-10T141652.243.png?v=1757503152"] },
  { code: "GVS-11251", urls: ["https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2025-09-10T142505.072.png?v=1768644743", "https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2025-07-29T143456.266.png?v=1768644743"] },
  { code: "GVS-11848", urls: ["https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2026-01-16T153416.786.png?v=1768570497", "https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2026-01-16T153340.443.png?v=1768570497"] },
  { code: "GVS-11978", urls: ["https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2026-01-16T153416.786.png?v=1768570497", "https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2026-01-16T153340.443.png?v=1768570497"] },
  { code: "GVS-12005", urls: ["https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2026-01-16T141902.741.png?v=1768566006"] },
  { code: "GVS-12012", urls: ["https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2026-01-16T140807.922.png?v=1768565317"] },
  { code: "GVS-12081", urls: ["https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2026-01-16T132433.923.png?v=1768562703"] },
  { code: "GVS-12098", urls: ["https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2026-01-16T124103.903.png?v=1768560130", "https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2026-01-16T125637.081.png?v=1768561056"] },
  { code: "GVS-12104", urls: ["https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2026-01-16T132821.825.png?v=1768562941"] },
  { code: "GVS-12111", urls: ["https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2026-01-16T125339.605.png?v=1768561012", "https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2026-01-16T125617.516.png?v=1768561012"] },
  { code: "GVS-12173", urls: ["https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2025-09-03T162757.232.png?v=1756906160", "https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2025-09-03T162824.049.png?v=1756906163"] },
  { code: "GVS-12470", urls: ["https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2026-01-16T151443.018.png?v=1768569302", "https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2026-01-16T151409.793.png?v=1768569303"] },
  { code: "GVS-12531", urls: ["https://cdn.shopify.com/s/files/1/0271/8603/6809/files/1zakp9xyr2bape8h6mblbzs98rl5378w.jpg?v=1682677177"] },
  { code: "GVS-13286", urls: ["https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2026-01-16T154748.728.png?v=1768571396"] },
  { code: "GVS-13675", urls: ["https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2026-01-17T122604.670.png?v=1768645583"] },
  { code: "GVS-13705", urls: ["https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2026-01-17T132734.687.png?v=1768649284"] },
  { code: "GVS-13736", urls: ["https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2026-08-27T154919.180.png?v=1787834974"] },
  { code: "GVS-14375", urls: ["https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2025-07-24T162843.634.png?v=1753363735"] },
  { code: "GVS-14382", urls: ["https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2026-01-16T165017.725.png?v=1768575044"] },
  { code: "GVS-14429", urls: ["https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2025-09-03T164921.561.png?v=1756907404", "https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2025-09-03T164933.339.png?v=1756907404"] },
  { code: "GVS-14764", urls: ["https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2026-08-26T142843.078.png?v=1787743774", "https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2026-08-26T142902.646.png?v=1787743773", "https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2026-08-26T142914.315.png?v=1787743773"] },
  { code: "GVS-14771", urls: ["https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2026-08-29T114641.526.png?v=1787993257"] },
  { code: "GVS-14788", urls: ["https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2026-08-26T143544.317.png?v=1787744153"] },
  { code: "GVS-14795", urls: ["https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2026-08-29T120032.463.png?v=1787994054", "https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2026-08-29T120306.376.png?v=1787994215"] },
  { code: "GVS-1481113", urls: ["https://cdn.shopify.com/s/files/1/0659/1234/0722/files/15.png?v=1740116677", "https://cdn.shopify.com/s/files/1/0659/1234/0722/files/Eye_Cream_Main_2.png?v=1740116677", "https://cdn.shopify.com/s/files/1/0659/1234/0722/files/18.png?v=1740116677"] },
  { code: "GVS-1482493", urls: ["https://cdn.shopify.com/s/files/1/0659/1234/0722/files/realtone13506.jpg?v=1725526469"] },
  { code: "GVS-1482509", urls: ["https://cdn.shopify.com/s/files/1/0659/1234/0722/files/realtone13506.jpg?v=1725526469"] },
  { code: "GVS-14849", urls: ["https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2026-08-26T143939.329.png?v=1787744393", "https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2026-08-29T121441.342.png?v=1787994893"] },
  { code: "GVS-1488075", urls: ["https://cdn.shopify.com/s/files/1/0659/1234/0722/files/REALTONE11875_2.jpg?v=1739343865", "https://cdn.shopify.com/s/files/1/0659/1234/0722/files/REALTONE11631_2.jpg?v=1739343865", "https://cdn.shopify.com/s/files/1/0659/1234/0722/files/REALTONE12151_2.jpg?v=1739343865"] },
  { code: "GVS-251981", urls: ["https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2025-08-16T120817.916.png?v=1755335320", "https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2025-08-16T114548.125.png?v=1755335320"] },
  { code: "GVS-253473", urls: ["https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2025-08-16T134205.781.png?v=1755340983", "https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2025-08-16T134225.775.png?v=1755340983"] },
  { code: "GVS-253480", urls: ["https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2025-08-16T134614.833.png?v=1755341199", "https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2025-08-16T134626.762.png?v=1755341198"] },
  { code: "GVS-254395", urls: ["https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2026-04-23T133650.092.png?v=1776940642", "https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2026-04-23T133713.079.png?v=1776940643"] },
  { code: "GVS-254494", urls: ["https://cdn.shopify.com/s/files/1/0806/6102/1007/files/FREEMOMENTGreenCalmingSerumMist_100ml_3.webp?v=1751974078", "https://cdn.shopify.com/s/files/1/0806/6102/1007/files/FREEMOMENTGreenCalmingSerumMist_100ml_5.jp4.jpg?v=1751974078", "https://cdn.shopify.com/s/files/1/0806/6102/1007/files/FREEMOMENTGreenCalmingSerumMist_100ml_9.webp?v=1751974078"] },
  { code: "GVS-255385", urls: ["https://cdn.shopify.com/s/files/1/0082/1346/3093/files/260901__________1.jpg?v=1788425688", "https://cdn.shopify.com/s/files/1/0082/1346/3093/files/260901__________3.jpg?v=1788425696"] },
  { code: "GVS-255385-DEFECT", urls: ["https://cdn.shopify.com/s/files/1/0082/1346/3093/files/260901__________1.jpg?v=1788425688", "https://cdn.shopify.com/s/files/1/0082/1346/3093/files/260901__________3.jpg?v=1788425696"] },
  { code: "GVS-2554846", urls: ["https://cdn.shopify.com/s/files/1/0659/1234/0722/files/realtone13422_2.jpg?v=1739783519", "https://cdn.shopify.com/s/files/1/0659/1234/0722/files/Serum2.png?v=1739783519"] },
  { code: "GVS-2554853", urls: ["https://cdn.shopify.com/s/files/1/0659/1234/0722/files/realtone13279.jpg?v=1739779083"] },
  { code: "GVS-255712", urls: ["https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2025-09-03T160148.218.png?v=1756904542", "https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2025-09-03T160202.081.png?v=1756904550"] },
  { code: "GVS-255736", urls: ["https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2025-09-03T141433.356.png?v=1756898103", "https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2025-09-03T141423.391.png?v=1756898103"] },
  { code: "GVS-255750", urls: ["https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2025-09-03T154501.310_21401a12-1701-43c2-83b9-ad98ecc98c94.png?v=1756903900", "https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2025-09-03T154518.144_17b20783-a4a3-4e17-ae72-3181828caddc.png?v=1756903900"] },
  { code: "GVS-255811", urls: ["https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2026-03-25T134932.937.png?v=1774439503"] },
  { code: "GVS-2559544", urls: ["https://cdn.shopify.com/s/files/1/0659/1234/0722/files/realtone13279.jpg?v=1739779083"] },
  { code: "GVS-255972", urls: ["https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2026-04-14T120101.765.png?v=1776157378", "https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2026-04-14T120210.428.png?v=1776157380"] },
  { code: "GVS-2559933", urls: ["https://cdn.shopify.com/s/files/1/0659/1234/0722/files/15.png?v=1740116677", "https://cdn.shopify.com/s/files/1/0659/1234/0722/files/Eye_Cream_Main_2.png?v=1740116677", "https://cdn.shopify.com/s/files/1/0659/1234/0722/files/18.png?v=1740116677"] },
  { code: "GVS-256115", urls: ["https://cdn.shopify.com/s/files/1/0082/1346/3093/files/260902_____345_100ml____1.jpg?v=1788425345", "https://cdn.shopify.com/s/files/1/0082/1346/3093/files/260902_____345_100ml____3.jpg?v=1788425356"] },
  { code: "GVS-256115-DEFECT", urls: ["https://cdn.shopify.com/s/files/1/0082/1346/3093/files/260902_____345_100ml____1.jpg?v=1788425345", "https://cdn.shopify.com/s/files/1/0082/1346/3093/files/260902_____345_100ml____3.jpg?v=1788425356"] },
  { code: "GVS-256122", urls: ["https://cdn.shopify.com/s/files/1/0082/1346/3093/files/260902_____345_100ml____1.jpg?v=1788425345", "https://cdn.shopify.com/s/files/1/0082/1346/3093/files/260902_____345_100ml____3.jpg?v=1788425356"] },
  { code: "GVS-256122-DEFECT", urls: ["https://cdn.shopify.com/s/files/1/0082/1346/3093/files/260902_____345_100ml____1.jpg?v=1788425345", "https://cdn.shopify.com/s/files/1/0082/1346/3093/files/260902_____345_100ml____3.jpg?v=1788425356"] },
  { code: "GVS-256221", urls: ["https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2025-12-17T114648.236.png?v=1765964826"] },
  { code: "GVS-256221-DEFECT", urls: ["https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2025-12-17T114648.236.png?v=1765964826"] },
  { code: "GVS-256283", urls: ["https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2026-08-06T165649.648.png?v=1786024632", "https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2026-08-06T165624.925.png?v=1786024632"] },
  { code: "GVS-256795", urls: ["https://cdn.shopify.com/s/files/1/0082/1346/3093/files/reinforce_your_skin_barrierwith_a_delicate_touchavailable_amazon_tiktokshopdoctoraltheaglobal.co_2.jpg?v=1784017930", "https://cdn.shopify.com/s/files/1/0082/1346/3093/files/260901_____147_____3.jpg?v=1788424956"] },
  { code: "GVS-256795-DEFECT", urls: ["https://cdn.shopify.com/s/files/1/0082/1346/3093/files/reinforce_your_skin_barrierwith_a_delicate_touchavailable_amazon_tiktokshopdoctoraltheaglobal.co_2.jpg?v=1784017930", "https://cdn.shopify.com/s/files/1/0082/1346/3093/files/260901_____147_____3.jpg?v=1788424956"] },
  { code: "GVS-3012017", urls: ["https://cdn.shopify.com/s/files/1/0659/1234/0722/files/realtone13482.jpg?v=1739779111"] },
  { code: "GVS-3013175", urls: ["https://cdn.shopify.com/s/files/1/0659/1234/0722/files/55.webp?v=1764128856", "https://cdn.shopify.com/s/files/1/0659/1234/0722/files/58.webp?v=1764128856", "https://cdn.shopify.com/s/files/1/0659/1234/0722/files/61.webp?v=1764128857"] },
  { code: "GVS-3013182", urls: ["https://cdn.shopify.com/s/files/1/0659/1234/0722/files/54.webp?v=1764138648", "https://cdn.shopify.com/s/files/1/0659/1234/0722/files/57.webp?v=1764138648", "https://cdn.shopify.com/s/files/1/0659/1234/0722/files/59.webp?v=1764138648"] },
  { code: "GVS-3255167", urls: ["https://cdn.shopify.com/s/files/1/0659/1234/0722/files/MaskPack_Vegan.jpg?v=1707207391", "https://cdn.shopify.com/s/files/1/0659/1234/0722/files/REALTONE15021.jpg?v=1707207391", "https://cdn.shopify.com/s/files/1/0659/1234/0722/files/re0021.jpg?v=1707207384"] },
  { code: "GVS-541881", urls: ["https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2026-01-16T160816.746.png?v=1768572670", "https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2026-01-16T160219.699.png?v=1768572670"] },
  { code: "GVS-5903568", urls: ["https://cdn.shopify.com/s/files/1/0659/1234/0722/files/REALTONE0163.jpg?v=1739778970", "https://cdn.shopify.com/s/files/1/0659/1234/0722/files/2.png?v=1739778970", "https://cdn.shopify.com/s/files/1/0659/1234/0722/files/3_0fabafaa-becb-4a01-aae2-a97efbda93fb.png?v=1739778970"] },
  { code: "GVS-5904008", urls: ["https://cdn.shopify.com/s/files/1/0659/1234/0722/files/REALTONE0163.jpg?v=1739778970", "https://cdn.shopify.com/s/files/1/0659/1234/0722/files/2.png?v=1739778970", "https://cdn.shopify.com/s/files/1/0659/1234/0722/files/3_0fabafaa-becb-4a01-aae2-a97efbda93fb.png?v=1739778970"] },
  { code: "GVS-5904305", urls: ["https://cdn.shopify.com/s/files/1/0659/1234/0722/files/5_eb923c74-9462-4cbc-a8f6-8fa3bb57a851.png?v=1739779018", "https://cdn.shopify.com/s/files/1/0659/1234/0722/files/9.png?v=1739779018", "https://cdn.shopify.com/s/files/1/0659/1234/0722/files/10.png?v=1739779018"] },
  { code: "GVS-6550430", urls: ["https://cdn.shopify.com/s/files/1/0659/1234/0722/files/KakaoTalk_20250318_170158110_01_Large_5bc74bd5-44d2-494f-9532-bc0c7ebc076b.jpg?v=1744082759"] },
  { code: "GVS-6555893", urls: ["https://cdn.shopify.com/s/files/1/0659/1234/0722/files/succinicserum.webp?v=1764062045", "https://cdn.shopify.com/s/files/1/0659/1234/0722/files/56.webp?v=1764062045", "https://cdn.shopify.com/s/files/1/0659/1234/0722/files/60.webp?v=1764062045"] },
  { code: "GVS-7118671", urls: ["https://cdn.shopify.com/s/files/1/0659/1234/0722/files/28.png?v=1751506372", "https://cdn.shopify.com/s/files/1/0659/1234/0722/files/29.png?v=1751506372", "https://cdn.shopify.com/s/files/1/0659/1234/0722/files/31.png?v=1751506372"] },
  { code: "GVS-7119180", urls: ["https://cdn.shopify.com/s/files/1/0659/1234/0722/files/REALTONE202435215_2.jpg?v=1726713776", "https://cdn.shopify.com/s/files/1/0659/1234/0722/files/REALTONE202435246_2.jpg?v=1726713811", "https://cdn.shopify.com/s/files/1/0659/1234/0722/files/REALTONE202435125_2.jpg?v=1726714344"] },
  { code: "GVS-7119623", urls: ["https://cdn.shopify.com/s/files/1/0659/1234/0722/files/28.png?v=1751506372", "https://cdn.shopify.com/s/files/1/0659/1234/0722/files/29.png?v=1751506372", "https://cdn.shopify.com/s/files/1/0659/1234/0722/files/31.png?v=1751506372"] },
  { code: "GVS-7251943", urls: ["https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2025-08-16T122515.863.png?v=1755336339", "https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2025-08-16T114548.125_ee8bfc3a-9fa4-41cb-88ff-a2eee29c80af.png?v=1755336339"] },
  { code: "GVS-9177655", urls: ["https://cdn.shopify.com/s/files/1/0659/1234/0722/files/13.png?v=1725527120", "https://cdn.shopify.com/s/files/1/0659/1234/0722/files/11.png?v=1725527120", "https://cdn.shopify.com/s/files/1/0659/1234/0722/files/12.png?v=1725527108"] },
  // --- second pass: Kosmos photos for Dr. Althea lines whose own store only had infographics, + Polatam pads
  { code: "GVS-251745", urls: ["https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2025-08-13T121424.224.png?v=1755076639", "https://cdn.shopify.com/s/files/1/0271/8603/6809/products/bb166dc5-9acb-4c03-bb10-5a4047c1e648.__CR0_0_300_300_PT0_SX300_V1.jpg?v=1755076639"] },
  { code: "GVS-251745-DEFECT", urls: ["https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2025-08-13T121424.224.png?v=1755076639", "https://cdn.shopify.com/s/files/1/0271/8603/6809/products/bb166dc5-9acb-4c03-bb10-5a4047c1e648.__CR0_0_300_300_PT0_SX300_V1.jpg?v=1755076639"] },
  { code: "GVS-255033", urls: ["https://cdn.shopify.com/s/files/1/0806/6102/1007/files/Dr.Althea-15_CalamineSpotPowder_15ml_2.png?v=1732708658"] },
  { code: "GVS-255071", urls: ["https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2025-07-10T135320.483.png?v=1752144938", "https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2025-07-10T135355.228.png?v=1752144938"] },
  { code: "GVS-256184", urls: ["https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2026-04-15T123647.445.png?v=1776245843", "https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2026-04-15T123659.122.png?v=1776245843"] },
  { code: "GVS-256191", urls: ["https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2026-08-26T142354.490.png?v=1787743464", "https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2026-08-26T142404.920.png?v=1787743465"] },
  { code: "GVS-256412", urls: ["https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2026-07-07T174141.216.png?v=1783435324", "https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2026-07-07T174153.132.png?v=1783435323"] },
  { code: "GVS-256658", urls: ["https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2026-08-26T141650.556.png?v=1787743034", "https://cdn.shopify.com/s/files/1/0271/8603/6809/files/2026-08-26T141703.354.png?v=1787743033"] },
  { code: "GVS-3005922", urls: ["https://co.nice-cdn.com/upload/image/product/large/default/85038_9847a9ba.1024x1024.png", "https://co.nice-cdn.com/upload/image/product/large/default/85041_cd913f80.1024x1024.png", "https://co.nice-cdn.com/upload/image/product/large/default/85044_29730949.1024x1024.png"] },
];

async function main() {
  let products = 0;
  let photos = 0;
  for (const entry of PLAN) {
    const product = await prisma.product.findUnique({ where: { code: entry.code }, include: { images: { orderBy: { sortOrder: "asc" } } } });
    if (!product) {
      console.log(`  [skip] not found: ${entry.code}`);
      continue;
    }
    if (product.images.length > 1 && !FORCE) {
      console.log(`  [skip] ${entry.code}: already has ${product.images.length} photos`);
      continue;
    }
    console.log(`  ${entry.code}: +${entry.urls.length}`);
    if (DRY_RUN) continue;
    const dir = path.join(process.cwd(), "public", "uploads", "products", encodeURIComponent(product.code));
    await mkdir(dir, { recursive: true });
    let order = product.images.length;
    for (const url of entry.urls) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
        if (!res.ok) {
          console.log(`    [error] HTTP ${res.status} ${url.slice(-50)}`);
          continue;
        }
        const buf = await sharp(Buffer.from(await res.arrayBuffer()))
          .flatten({ background: "#ffffff" })
          .resize(MAX_EDGE, MAX_EDGE, { fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 88 })
          .toBuffer();
        const name = `${randomBytes(6).toString("hex")}-${order}.jpg`;
        await sharp(buf).toFile(path.join(dir, name));
        await prisma.productImage.create({ data: { productId: product.id, url: `/uploads/products/${encodeURIComponent(product.code)}/${name}`, sortOrder: order } });
        order++;
        photos++;
      } catch (err) {
        console.log(`    [error] ${url.slice(-50)}: ${err instanceof Error ? err.message : err}`);
      }
    }
    products++;
  }
  console.log(`\nDone. ${photos} photos added to ${products} products.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
