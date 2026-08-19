import { rm } from "node:fs/promises";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = resolve(packageRoot, "dist");

if (dirname(outputPath) !== packageRoot || basename(outputPath) !== "dist") {
  throw new Error("Refusing to clean an unexpected server output path.");
}
await rm(outputPath, { recursive: true, force: true });
