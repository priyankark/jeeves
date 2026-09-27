import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const index = JSON.parse(await readFile("jeeves-marketplace.json", "utf8"));
if (index.version !== 1 || !Array.isArray(index.workflows))
  throw new Error("Invalid catalog");
for (const entry of index.workflows) {
  if (!/^marketplace\/workflows\/[a-z0-9-]+\.json$/.test(entry.path))
    throw new Error("Invalid contribution path");
  const bytes = await readFile(entry.path);
  if (createHash("sha256").update(bytes).digest("hex") !== entry.sha256)
    throw new Error(`Checksum mismatch: ${entry.id}`);
  const { validatePackage } = await import("../server/packages.ts");
  validatePackage(JSON.parse(bytes.toString()));
}
console.log(`Validated ${index.workflows.length} workflow packages.`);
