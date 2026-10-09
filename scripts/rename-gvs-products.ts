// Renames the 118 GVS Cosmetics products to "<brand + original name> – <short Czech
// description of what it is> – <size>" (owner request 2026-10-09: a customer who
// doesn't know the brands can't tell from "Dr.Althea 147 Barrier Cream" what the
// product is; Cosibella / Kosco / K-Sisters all spell it out). Also tidies brand
// spelling (Dr.Althea -> Dr. Althea, Vvbetter -> VVBETTER, FREEMOMENT -> Free Moment,
// the Green Calming Mist that was mislabelled Dr. Althea). `before` keeps the old
// name so the change can be reverted with --revert. Slugs/URLs are NOT touched.
//
// Usage: npx tsx scripts/rename-gvs-products.ts --dry-run | (no flag = apply) | --revert
import { prisma } from "../src/lib/prisma";
import { logAdminActivity } from "../src/lib/admin/activity-log";

const DRY_RUN = process.argv.includes("--dry-run");
const REVERT = process.argv.includes("--revert");

const NAMES: Record<string, { before: string; after: string }> = {
  "GVS-10179": { before: "CP-1 Raspberry Treatment Vinegar, 500ml", after: "CP-1 Raspberry Treatment Vinegar – Oplachový kondicionér s malinovým octem – 500 ml" },
  "GVS-10230": { before: "CP-1 Keratin Concentrate Ampoule, 80ml", after: "CP-1 Keratin Concentrate Ampoule – Keratinová esence na vlasy – 80 ml" },
  "GVS-541881": { before: "CP-1 Keratin Concentrate Ampoule, 10ml", after: "CP-1 Keratin Concentrate Ampoule – Keratinová esence na vlasy – vzorek 10 ml" },
  "GVS-10551": { before: "CP-1 Premium Hair Treatment, 25ml", after: "CP-1 Premium Hair Treatment – Proteinová maska na vlasy – 25 ml" },
  "GVS-11251": { before: "CP-1 Premium Hair Treatment, 250ml", after: "CP-1 Premium Hair Treatment – Proteinová maska na vlasy – 250 ml" },
  "GVS-10582": { before: "CP-1 Premium Silk Ampoule, 1pcs*20ml", after: "CP-1 Premium Silk Ampoule – Nezmývatelné hedvábné sérum na vlasy – jednorázová ampule 20 ml" },
  "GVS-11022": { before: "CP-1 Premium Silk Ampoule, 150ml", after: "CP-1 Premium Silk Ampoule – Nezmývatelné hedvábné sérum na vlasy – 150 ml" },
  "GVS-11848": { before: "CP-1 3 Seconds Hair Fill-Up Ampoule, 170ml", after: "CP-1 3 Seconds Hair Fill-Up Ampoule – Regenerační vlasová ampule – 170 ml" },
  "GVS-11978": { before: "CP-1 3 Seconds Hair Fill-Up Ampoule, 1pcs*13ml", after: "CP-1 3 Seconds Hair Fill-Up Ampoule – Regenerační vlasová ampule – jednorázová ampule 13 ml" },
  "GVS-12005": { before: "CP-1 Ginger Purifying Shampoo, 500ml", after: "CP-1 Ginger Purifying Shampoo – Šampon se zázvorem pro hloubkové čištění pokožky hlavy – 500 ml" },
  "GVS-13262": { before: "CP-1 Ginger Purifying Shampoo, 100ml", after: "CP-1 Ginger Purifying Shampoo – Šampon se zázvorem pro hloubkové čištění pokožky hlavy – 100 ml" },
  "GVS-12012": { before: "CP-1 Ginger Purifying Conditioner, 500ml", after: "CP-1 Ginger Purifying Conditioner – Kondicionér se zázvorem pro suché vlasy – 500 ml" },
  "GVS-13279": { before: "CP-1 Ginger Purifying Conditioner, 100ml", after: "CP-1 Ginger Purifying Conditioner – Kondicionér se zázvorem pro suché vlasy – 100 ml" },
  "GVS-12074": { before: "CP-1 Cool Mint Shampoo, 500ml", after: "CP-1 Head Spa Cool Mint Shampoo – Osvěžující mátový šampon – 500 ml" },
  "GVS-13286": { before: "CP-1 Cool Mint Shampoo, 100ml", after: "CP-1 Head Spa Cool Mint Shampoo – Osvěžující mátový šampon – 100 ml" },
  "GVS-12081": { before: "CP-1 Bright Complex Intense Nourishing Shampoo Version 2.0, 500 ml", after: "CP-1 Bright Complex Intense Nourishing Shampoo 2.0 – Vyživující šampon s proteiny a kolagenem – 500 ml" },
  "GVS-12104": { before: "CP-1 Bright Complex Intense Nourishing Shampoo Version 2.0, 100 ml", after: "CP-1 Bright Complex Intense Nourishing Shampoo 2.0 – Vyživující šampon s proteiny a kolagenem – 100 ml" },
  "GVS-12098": { before: "CP-1 Bright Complex Intense Nourishing Conditioner Version 2.0, 500 ml", after: "CP-1 Bright Complex Intense Nourishing Conditioner 2.0 – Intenzivně vyživující kondicionér – 500 ml" },
  "GVS-12111": { before: "CP-1 Bright Complex Intense Nourishing Conditioner 2.0, 100 ml", after: "CP-1 Bright Complex Intense Nourishing Conditioner 2.0 – Intenzivně vyživující kondicionér – 100 ml" },
  "GVS-12173": { before: "Esthetic House Toxheal Red Glycolic Peeling Serum, 100 ml", after: "Esthetic House Toxheal Red Glycolic Peeling Serum – Peelingové sérum s glykolovou kyselinou – 100 ml" },
  "GVS-12470": { before: "CP-1 Head Spa Peeling Ampoule, 1pcs*20ml", after: "CP-1 Head Spa Peeling Ampoule – Peelingové sérum na pokožku hlavy – jednorázová ampule 20 ml" },
  "GVS-12524": { before: "CP-1 3 Seconds Hair Fill-Up Shampoo, 500ml", after: "CP-1 3 Seconds Hair Fill-Up Shampoo – Regenerační šampon na poškozené vlasy – 500 ml" },
  "GVS-12531": { before: "CP-1 3 Seconds Hair Fill-Up Shampoo, 100ml", after: "CP-1 3 Seconds Hair Fill-Up Shampoo – Regenerační šampon na poškozené vlasy – 100 ml" },
  "GVS-13668": { before: "CP-1 Aquaxyl Complex Intense Moisture Shampoo, 500 ml", after: "CP-1 Aquaxyl Complex Intense Moisture Shampoo – Hydratační šampon pro barvené vlasy – 500 ml" },
  "GVS-13675": { before: "CP-1 Aquaxyl Complex Intense Moisture Shampoo, 100ml", after: "CP-1 Aquaxyl Complex Intense Moisture Shampoo – Hydratační šampon pro barvené vlasy – 100 ml" },
  "GVS-13699": { before: "CP-1 Aquaxyl Complex Intense Moisture Conditioner, 500ml", after: "CP-1 Aquaxyl Complex Intense Moisture Conditioner – Hydratační kondicionér pro poškozené vlasy – 500 ml" },
  "GVS-13705": { before: "CP-1 Aquaxyl Complex Intense Moisture Conditioner, 100ml", after: "CP-1 Aquaxyl Complex Intense Moisture Conditioner – Hydratační kondicionér pro poškozené vlasy – 100 ml" },
  "GVS-13736": { before: "CP-1 3 Seconds Hair Fill-Up Conditioner, 500ml", after: "CP-1 3 Seconds Hair Fill-Up Conditioner – Regenerační kondicionér na vlasy – 500 ml" },
  "GVS-13774": { before: "CP-1 3 Seconds Hair Fill-Up Conditioner, 100ml", after: "CP-1 3 Seconds Hair Fill-Up Conditioner – Regenerační kondicionér na vlasy – 100 ml" },
  "GVS-13996": { before: "Esthetic House Toxheal Red Glycolic AHA·BHA·PHA Toner, 180 ml", after: "Esthetic House Toxheal Red Glycolic AHA·BHA·PHA Toner – Exfoliační pleťové tonikum s kyselinami – 180 ml" },
  "GVS-14016": { before: "CP-1 Tea Tree Mint Shampoo, 500 ml", after: "CP-1 Tea Tree Mint Shampoo – Osvěžující šampon s čajovníkem a mátou – 500 ml" },
  "GVS-14375": { before: "CP-1 Volume Booster Shampoo, 500ml", after: "CP-1 Volume Booster Shampoo – Šampon pro objem vlasů – 500 ml" },
  "GVS-14382": { before: "CP-1 Volume Booster Conditioner, 500ml", after: "CP-1 Volume Booster Conditioner – Kondicionér pro objem vlasů – 500 ml" },
  "GVS-14429": { before: "CP-1 LPP Collagen Repair Hair Mask, 300 ml", after: "CP-1 LPP Collagen Repair Hair Mask – Regenerační maska na vlasy s kolagenem – 300 ml" },
  "GVS-14535": { before: "CP-1 Head Spa Pink Salt Scalp Scaler, 200 ml", after: "CP-1 Head Spa Pink Salt Scalp Scaler – Peeling na pokožku hlavy s růžovou solí – 200 ml" },
  "GVS-14726": { before: "CP-1 Detox Purifying Scalp Refresh Shampoo 500ml", after: "CP-1 Detox Purifying Scalp Refresh Shampoo – Detoxikační šampon na pokožku hlavy – 500 ml" },
  "GVS-14733": { before: "CP-1 Detox Purifying Scalp Refresh Shampoo 100ml", after: "CP-1 Detox Purifying Scalp Refresh Shampoo – Detoxikační šampon na pokožku hlavy – 100 ml" },
  "GVS-14740": { before: "CP-1 Detox Purifying Scalp Refresh Conditioner 500ml", after: "CP-1 Detox Purifying Scalp Refresh Conditioner – Kondicionér pro osvěžení pokožky hlavy – 500 ml" },
  "GVS-14757": { before: "CP-1 Detox Purifying Scalp Refresh Conditioner 100ml", after: "CP-1 Detox Purifying Scalp Refresh Conditioner – Kondicionér pro osvěžení pokožky hlavy – 100 ml" },
  "GVS-14764": { before: "CP-1 Keratin Intensive Fill-up Hair Shampoo 500ml", after: "CP-1 Keratin Intensive Fill-up Hair Shampoo – Keratinový šampon na poškozené vlasy – 500 ml" },
  "GVS-14771": { before: "CP-1 Keratin Intensive Fill-up Hair Shampoo 100ml", after: "CP-1 Keratin Intensive Fill-up Hair Shampoo – Keratinový šampon na poškozené vlasy – 100 ml" },
  "GVS-14788": { before: "CP-1 Keratin Intensive Fill-up Hair Conditioner 500ml", after: "CP-1 Keratin Intensive Fill-up Hair Conditioner – Keratinový kondicionér na poškozené vlasy – 500 ml" },
  "GVS-14795": { before: "CP-1 Keratin Intensive Fill-up Hair Conditioner 100ml", after: "CP-1 Keratin Intensive Fill-up Hair Conditioner – Keratinový kondicionér na poškozené vlasy – 100 ml" },
  "GVS-14849": { before: "CP-1 Keratin Intensive Fill-up Hair Mask 200ml", after: "CP-1 Keratin Intensive Fill-up Hair Mask – Keratinová maska na vlasy – 200 ml" },
  "GVS-14856": { before: "CP-1 Keratin Intensive Fill-up No-wash Treatment 150ml", after: "CP-1 Keratin Intensive Fill-up No-wash Treatment – Bezoplachová keratinová péče na vlasy – 150 ml" },
  "GVS-10933": { before: "CP-1 Head Spa Scalp Scaler, 210ml", after: "CP-1 Head Spa Scalp Scaler – Peeling na pokožku hlavy – 210 ml" },
  "GVS-251745": { before: "Dr.Althea Rapid Firm Sculpting Cream", after: "Dr. Althea Rapid Firm Sculpting Cream – Zpevňující krém proti vráskám" },
  "GVS-251745-DEFECT": { before: "Dr.Althea Rapid Firm Sculpting Cream (poškozený obal)", after: "Dr. Althea Rapid Firm Sculpting Cream – Zpevňující krém proti vráskám (poškozený obal)" },
  "GVS-251981": { before: "Dr.Althea Marine Anti-Blemish Mask", after: "Dr. Althea Marine Anti-Blemish Mask – Zklidňující plátýnková maska" },
  "GVS-253091": { before: "Dr.Althea Face Blur Finishing Powder", after: "Dr. Althea Face Blur Finishing Powder – Fixační pudr na obličej" },
  "GVS-253473": { before: "Dr.Althea Skin Relief Essence", after: "Dr. Althea Skin Relief Essence – Zklidňující ampulová esence s centellou – 30 ml" },
  "GVS-253480": { before: "Dr.Althea Natural Radiance Essence", after: "Dr. Althea Natural Radiance Essence – Rozjasňující esence s kakadu švestkou – 30 ml" },
  "GVS-253756": { before: "Dr.Althea Premium Quick Step Sebum Cleanser", after: "Dr. Althea Premium Quick Step Sebum Cleanser – Jemný čisticí přípravek na póry" },
  "GVS-254395": { before: "Dr.Althea To Be Youthful Eye Serum", after: "Dr. Althea To Be Youthful Eye Serum – Oční sérum proti vráskám – 25 ml" },
  "GVS-254494": { before: "Dr.Althea Free Moment Green Calming Serum Mist", after: "Free Moment Green Calming Serum Mist – Zklidňující sérová mlha na obličej – 100 ml" },
  "GVS-255033": { before: "Dr.Althea 15% Calamine Spot Powder, 15ml", after: "Dr. Althea 15% Calamine Spot Powder – Lokální péče na problematická místa – 15 ml" },
  "GVS-255071": { before: "Dr.Althea Pure Grinding Cleansing Balm", after: "Dr. Althea Pure Grinding Cleansing Balm – Odličovací čisticí balzám" },
  "GVS-255101": { before: "Dr.Althea Gentle Vitamin C Serum", after: "Dr. Althea Gentle Vitamin C Serum – Jemné rozjasňující sérum s vitaminem C" },
  "GVS-255293": { before: "Dr.Althea 2% Salicylic Acid Clear Pad", after: "Dr. Althea 2% Salicylic Acid Clear Pad – Čisticí polštářky s kyselinou salicylovou" },
  "GVS-255385": { before: "Dr.Althea Vitamin C Boosting Serum", after: "Dr. Althea Vitamin C Boosting Serum – Rozjasňující pleťové sérum s vitaminem C – 30 ml" },
  "GVS-255385-DEFECT": { before: "Dr.Althea Vitamin C Boosting Serum (poškozený obal)", after: "Dr. Althea Vitamin C Boosting Serum – Rozjasňující pleťové sérum s vitaminem C – 30 ml (poškozený obal)" },
  "GVS-255620": { before: "Dr.Althea Pore Refresh Grinding Cleansing Balm", after: "Dr. Althea Pore Refresh Grinding Cleansing Balm – Čisticí balzám na póry" },
  "GVS-255712": { before: "Dr.Althea Cushion Veil Calming Mask", after: "Dr. Althea Cushion Veil Calming Mask – Chladivá zklidňující plátýnková maska" },
  "GVS-255736": { before: "Dr.Althea Jelly Seal Dewy Mask", after: "Dr. Althea Jelly Seal Dewy Mask – Hydratační gelová maska" },
  "GVS-255750": { before: "Dr.Althea Aqua Blue Hydration Mask", after: "Dr. Althea Aqua Blue Hydration Mask – Hydratační plátýnková maska" },
  "GVS-255811": { before: "Dr.Althea Vita Glow Mask", after: "Dr. Althea Vita Glow Mask – Rozjasňující plátýnková maska" },
  "GVS-255972": { before: "Dr.Althea Aqua Glowing Sunscreen", after: "Dr. Althea Aqua Glowing Sunscreen SPF50+ – Hydratační opalovací krém na obličej – 45 ml" },
  "GVS-256115": { before: "Dr.Althea 345 Relief Cream Mist 100ml", after: "Dr. Althea 345 Relief Cream Mist – Zklidňující krémový sprej na obličej – 100 ml" },
  "GVS-256115-DEFECT": { before: "Dr.Althea 345 Relief Cream Mist 100ml (poškozený obal)", after: "Dr. Althea 345 Relief Cream Mist – Zklidňující krémový sprej na obličej – 100 ml (poškozený obal)" },
  "GVS-256122": { before: "Dr.Althea 345 Relief Cream Mist 60ml", after: "Dr. Althea 345 Relief Cream Mist – Zklidňující krémový sprej na obličej – 60 ml" },
  "GVS-256122-DEFECT": { before: "Dr.Althea 345 Relief Cream Mist 60ml (poškozený obal)", after: "Dr. Althea 345 Relief Cream Mist – Zklidňující krémový sprej na obličej – 60 ml (poškozený obal)" },
  "GVS-256184": { before: "Dr.Althea Aqua Marine Jelly Mist", after: "Dr. Althea Aqua Marine Jelly Mist – Hydratační mlha na obličej – 100 ml" },
  "GVS-256191": { before: "Dr.Althea Aqua Marine Deep Serum", after: "Dr. Althea Aqua Marine Deep Serum – Hydratační pleťové sérum – 30 ml" },
  "GVS-256221": { before: "Dr.Althea345 Relief Cream (Renewal), 50ml", after: "Dr. Althea 345 Relief Cream (Renewal) – Regenerační krém na obličej – 50 ml" },
  "GVS-256221-DEFECT": { before: "Dr.Althea345 Relief Cream (Renewal), 50ml (poškozený obal)", after: "Dr. Althea 345 Relief Cream (Renewal) – Regenerační krém na obličej – 50 ml (poškozený obal)" },
  "GVS-256429": { before: "Dr.Althea 345 Relief Cream, 15ml", after: "Dr. Althea 345 Relief Cream – Regenerační krém na obličej – 15 ml" },
  "GVS-256429-DEFECT": { before: "Dr.Althea 345 Relief Cream, 15ml (poškozený obal)", after: "Dr. Althea 345 Relief Cream – Regenerační krém na obličej – 15 ml (poškozený obal)" },
  "GVS-256238": { before: "Dr.Althea ABC Glow Whipped Serum", after: "Dr. Althea ABC Glow Whipped Serum – Pěnové rozjasňující sérum" },
  "GVS-256276": { before: "Dear.A Cool Fit Primer", after: "Dear.A Cool Fit Primer – Báze pod make-up" },
  "GVS-256283": { before: "Dr.Althea 345 Relief Cream Mask", after: "Dr. Althea 345 Relief Cream Mask – Zklidňující plátýnková maska" },
  "GVS-256306": { before: "Dr.Althea Stretchfit Calming Pad", after: "Dr. Althea StretchFit Calming Pad – Zklidňující polštářky na obličej" },
  "GVS-256412": { before: "Dr.Althea Reju 5000 Cream", after: "Dr. Althea Reju 5000 Cream – Zklidňující krém s PDRN" },
  "GVS-256658": { before: "Dr.Althea Retinol Flat Iron Eye Roller", after: "Dr. Althea Retinol Flat Iron Eye Roller – Oční sérum s retinolem a masážním válečkem" },
  "GVS-256795": { before: "Dr.Althea 147 Barrier Cream, 50ml", after: "Dr. Althea 147 Barrier Cream – Hydratační krém pro obnovu pleťové bariéry – 50 ml" },
  "GVS-256795-DEFECT": { before: "Dr.Althea 147 Barrier Cream, 50ml (poškozený obal)", after: "Dr. Althea 147 Barrier Cream – Hydratační krém pro obnovu pleťové bariéry – 50 ml (poškozený obal)" },
  "GVS-257020": { before: "Dr.Althea Melaclear Cream", after: "Dr. Althea Melaclear Cream – Krém proti pigmentovým skvrnám" },
  "GVS-7251943": { before: "Dr.Althea Oasis Soothing Mask", after: "Dr. Althea Oasis Soothing Mask – Zklidňující plátýnková maska" },
  "GVS-1481113": { before: "Vvbetter Firming Eye Cream, 1 ml", after: "VVBETTER Firming Eye Cream – Zpevňující oční krém – vzorek 1 ml" },
  "GVS-2559933": { before: "Vvbetter Firming Eye Cream, 30 ml", after: "VVBETTER Firming Eye Cream – Zpevňující oční krém – 30 ml" },
  "GVS-1482493": { before: "Vvbetter Soothing Cleansing Foam, 2 ml", after: "VVBETTER Soothing Cleansing Foam – Jemná čisticí pěna na obličej – vzorek 2 ml" },
  "GVS-1482509": { before: "Vvbetter Soothing Cleansing Foam, 120 ml", after: "VVBETTER Soothing Cleansing Foam – Jemná čisticí pěna na obličej – 120 ml" },
  "GVS-1488075": { before: "Vvbetter Jeju Yuja Balancing Bubble Cleanser, 145 ml", after: "VVBETTER Jeju Yuja Balancing Bubble Cleanser – Čisticí pěna pro mastnou pleť – 145 ml" },
  "GVS-2554846": { before: "Vvbetter Teca Lifting Moisture Serum, 30 ml", after: "VVBETTER Teca Lifting Moisture Serum – Hydratační a zpevňující sérum – 30 ml" },
  "GVS-2554853": { before: "Vvbetter Teca Lifting Moisture Cream, 50 ml", after: "VVBETTER Teca Lifting Moisture Cream – Hydratační zpevňující krém – 50 ml" },
  "GVS-2559544": { before: "Vvbetter Teca Lifting Moisture Cream, 2 ml", after: "VVBETTER Teca Lifting Moisture Cream – Hydratační zpevňující krém – vzorek 2 ml" },
  "GVS-2555218": { before: "Vvbetter Konjac Sponge, 5 г", after: "VVBETTER Konjac Sponge – Čisticí houbička z konjaku – 1 ks" },
  "GVS-3012017": { before: "Vvbetter Aha Boosting Toner, 200 ml", after: "VVBETTER AHA Boosting Toner – Exfoliační pleťové tonikum s AHA – 200 ml" },
  "GVS-3013175": { before: "Vvbetter Firming Bakuchiol Pdrn Serum", after: "VVBETTER Firming Bakuchiol PDRN Serum – Zpevňující sérum s bakuchiolem – 30 ml" },
  "GVS-3013182": { before: "Vvbetter Dark Spot Solution Vita C Trx Serum", after: "VVBETTER Dark Spot Solution Vita C TRX Serum – Sérum proti pigmentovým skvrnám – 30 ml" },
  "GVS-3255167": { before: "Vvbetter Rejuvenating Squalane Mask", after: "VVBETTER Rejuvenating Squalane Mask – Omlazující plátýnková maska se skvalanem – 5 ks" },
  "GVS-5903568": { before: "Vvbetter Daily Airfit Sunscreen Spf 50+", after: "VVBETTER Daily Airfit Sunscreen SPF50+ – Denní opalovací krém na obličej – 50 ml" },
  "GVS-5904008": { before: "Vvbetter Daily Airfit Sunscreen 50+ Spf, 1 ml", after: "VVBETTER Daily Airfit Sunscreen SPF50+ – Denní opalovací krém na obličej – vzorek 1 ml" },
  "GVS-5904305": { before: "Vvbetter Gentle Deep Cleansing Oil, 200 ml", after: "VVBETTER Gentle Deep Cleansing Oil – Jemný odličovací olej – 200 ml" },
  "GVS-6550430": { before: "Vvbetter Travel Kit Blue", after: "VVBETTER Travel Kit Blue – Cestovní sada pro péči o pleť – 4 mini produkty" },
  "GVS-6555893": { before: "Vvbetter Jeju Yuja Succinic Balancing Serum", after: "VVBETTER Jeju Yuja Succinic Balancing Serum – Vyvažující sérum pro mastnou pleť – 30 ml" },
  "GVS-7118671": { before: "Vvbetter Jeju Yuja Balancing Pad", after: "VVBETTER Jeju Yuja Balancing Pad – Tonikové polštářky pro mastnou pleť – 120 ks" },
  "GVS-7119180": { before: "Vvbetter Jeju Yuja Cera Balancing Cream, 50 ml", after: "VVBETTER Jeju Yuja Cera Balancing Cream – Vyvažující gelový krém s ceramidy – 50 ml" },
  "GVS-7119623": { before: "Vvbetter JEJU YUJA BALANCING PAD_POUCH", after: "VVBETTER Jeju Yuja Balancing Pad (pouzdro) – Tonikové polštářky pro mastnou pleť" },
  "GVS-9177655": { before: "Vvbetter Gentle Purifying Mud Mask, 60 ml", after: "VVBETTER Gentle Purifying Mud Mask – Čisticí jílová maska – 60 ml" },
  "GVS-3005106": { before: "Polatam Cica Malacalming Power Ampoule", after: "Polatam Cica Malacalming Power Ampoule – Intenzivní pleťové sérum pro citlivou pleť – 50 ml" },
  "GVS-3005205": { before: "Polatam Cica Malacalming Soothing Cream", after: "Polatam Cica Malacalming Soothing Cream – Zklidňující hydratační krém – 50 ml" },
  "GVS-3005205-DEFECT": { before: "Polatam Cica Malacalming Soothing Cream (poškozený obal)", after: "Polatam Cica Malacalming Soothing Cream – Zklidňující hydratační krém – 50 ml (poškozený obal)" },
  "GVS-3005922": { before: "Polatam Cica Malacalming Ampoule Fit Pad", after: "Polatam Cica Malacalming Ampoule Fit Pad – Hydratační pleťové polštářky – 100 ks" },
  "GVS-3006318": { before: "Polatam Cica Malacalming Moisturizing Cream", after: "Polatam Cica Malacalming Moisturizing Cream – Hydratační krém pro suchou pleť – 50 ml" },
  "GVS-254944": { before: "FREEMOMENT Refresh Moment Perfume Shampoo 01 Jeju Camellia", after: "Free Moment Refresh Moment Perfume Shampoo 01 Jeju Camellia – Parfémovaný šampon – 500 ml" },
  "GVS-254951": { before: "Refresh Moment Perfume Shampoo 02 Fig Fog (FREEMOMENT)", after: "Free Moment Refresh Moment Perfume Shampoo 02 Fig Fog – Parfémovaný šampon – 500 ml" },
  "GVS-254968": { before: "FREEMOMENT Refresh Moment Perfume Treatment 01 Jeju Camellia", after: "Free Moment Refresh Moment Perfume Treatment 01 Jeju Camellia – Parfémovaná vlasová péče – 150 ml" },
  "GVS-254975": { before: "Refresh Moment Perfume Treatment 02 Fig Fog (FREEMOMENT)", after: "Free Moment Refresh Moment Perfume Treatment 02 Fig Fog – Parfémovaná vlasová péče – 150 ml" },
};

async function main() {
  let changed = 0;
  for (const [code, n] of Object.entries(NAMES)) {
    const target = REVERT ? n.before : n.after;
    const product = await prisma.product.findUnique({ where: { code }, select: { id: true, name: true } });
    if (!product) {
      console.log(`  [skip] not found: ${code}`);
      continue;
    }
    if (product.name === target) continue;
    console.log(`  ${code}: ${product.name}  =>  ${target}`);
    if (DRY_RUN) continue;
    await prisma.product.update({ where: { id: product.id }, data: { name: target } });
    changed++;
  }
  if (!DRY_RUN && changed > 0) {
    await logAdminActivity({ action: "product.gvs_rename", entityType: "Product", detail: `GVS: ${REVERT ? "reverted" : "renamed"} ${changed} products` });
  }
  console.log(`\nDone. ${changed} ${REVERT ? "reverted" : "renamed"}.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
