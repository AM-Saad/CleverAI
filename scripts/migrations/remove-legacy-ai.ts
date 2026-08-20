import { MongoClient } from "mongodb";

const apply = process.argv.includes("--apply");
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");

const client = new MongoClient(url);
await client.connect();
try {
  const db = client.db();
  const legacyCollections = [
    "LlmPrice",
    "llm_model_registry",
    "llm_gateway_logs",
  ];
  const existing = new Set(
    (await db.listCollections({}, { nameOnly: true }).toArray()).map(
      ({ name }) => name,
    ),
  );
  const targets = legacyCollections.filter((name) => existing.has(name));
  console.log({ mode: apply ? "apply" : "dry-run", dropCollections: targets });
  if (!apply) {
    console.log(
      "Re-run with --apply to remove legacy AI catalog/log collections and fields.",
    );
  } else {
    for (const name of targets) await db.collection(name).drop();
    await db
      .collection("Workspace")
      .updateMany({}, { $unset: { llmModel: "" } });
    await db
      .collection("Material")
      .updateMany({}, { $unset: { llmModel: "", llmPrompt: "" } });
    await db.collection("LlmUsage").updateMany(
      {},
      {
        $unset: {
          inputPer1kMicrosSnapshot: "",
          outputPer1kMicrosSnapshot: "",
        },
      },
    );
    console.log("Legacy AI database state removed.");
  }
} finally {
  await client.close();
}
