// Creates the starter loyalty rewards (only when the catalogue is empty) — run once after the
// 20261031120000_loyalty_rewards migration. Costs/values can be changed in /admin/body-odmeny afterwards.
//
//   npx tsx --env-file=.env scripts/seed-loyalty-rewards.ts
import { prisma } from "../src/lib/prisma";

async function main() {
  if ((await prisma.loyaltyReward.count()) > 0) {
    console.log("Rewards already exist — nothing to do.");
    return;
  }
  await prisma.loyaltyReward.createMany({
    data: [
      { name: "Doprava zdarma", nameSk: "Doprava zadarmo", pointsCost: 1000, type: "FREE_SHIPPING", validDays: 60, sortOrder: 1 },
      { name: "Sleva 100 Kč", nameSk: "Zľava 100 Kč", pointsCost: 1500, type: "FIXED", value: 100, minOrderValue: 600, validDays: 60, sortOrder: 2 },
      { name: "Dárek zdarma", nameSk: "Darček zadarmo", pointsCost: 1500, type: "GIFT", validDays: 60, sortOrder: 3 },
    ],
  });
  console.log("Created 3 starter rewards.");
}

main().finally(() => prisma.$disconnect());
