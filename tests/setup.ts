import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll } from "vitest";
const dir = mkdtempSync(path.join(tmpdir(), "jeeves-unit-"));
process.env.JEEVES_DATA_DIR = dir;
afterAll(() => rmSync(dir, { recursive: true, force: true }));
