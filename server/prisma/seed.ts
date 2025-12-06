// // prisma/seed.ts
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting development database seeding...");

  console.log("Cleaning up existing data...");
  await prisma.llmPrice.deleteMany({
    where: {
      OR: [
        { provider: "openai", model: "gpt-4o" },
        { provider: "google", model: "gemini-1.5-pro" },
        { provider: "google", model: "gemini-1.5-flash" },
        { provider: "google", model: "gemini-2.0-flash-lite" },
      ],
    },
  });

  console.log("Seeding LLM prices...");
  await prisma.llmPrice.upsert({
    where: { provider_model: { provider: "openai", model: "gpt-4o" } },
    update: {
      inputPer1kMicros: 5000n,
      outputPer1kMicros: 15000n,
      isActive: true,
    },
    create: {
      provider: "openai",
      model: "gpt-4o",
      inputPer1kMicros: 5000n,
      outputPer1kMicros: 15000n,
      isActive: true,
    },
  });

  await prisma.llmPrice.upsert({
    where: {
      provider_model: { provider: "google", model: "gemini-1.5-flash" },
    },
    update: {
      inputPer1kMicros: 350n,
      outputPer1kMicros: 1050n,
      isActive: true,
    },
    create: {
      provider: "google",
      model: "gemini-1.5-flash",
      inputPer1kMicros: 350n,
      outputPer1kMicros: 1050n,
      isActive: true,
    },
  });

  // Gemini 2.0 Flash Lite pricing (per 1k tokens in micros)
  // Input: $0.075/1M = 75 micros/1k, Output: $0.30/1M = 300 micros/1k
  await prisma.llmPrice.upsert({
    where: {
      provider_model: { provider: "google", model: "gemini-2.0-flash-lite" },
    },
    update: { inputPer1kMicros: 75n, outputPer1kMicros: 300n, isActive: true },
    create: {
      provider: "google",
      model: "gemini-2.0-flash-lite",
      inputPer1kMicros: 75n,
      outputPer1kMicros: 300n,
      isActive: true,
    },
  });

  console.log("✅ Development seeding completed successfully!");

  console.log(
    "\n💡 This script only creates missing data. Use the full seed script for complete data reset."
  );
}

main()
  .catch((e) => {
    console.error("❌ Error during seeding:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
