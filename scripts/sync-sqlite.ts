import { ensureSqliteSync } from "../server/datasetService.ts";

async function main() {
  console.log("Starting SQLite sync test...");
  const t0 = Date.now();
  await ensureSqliteSync();
  console.log(`SQLite sync finished in ${((Date.now() - t0) / 1000).toFixed(2)}s`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Error in sync-sqlite:", err);
  process.exit(1);
});
