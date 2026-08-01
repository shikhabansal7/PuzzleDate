import { mkdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const extensionDirectory = path.join(projectRoot, "chrome-extension");
const outputDirectory = path.join(projectRoot, "public", "downloads");
const outputFile = path.join(outputDirectory, "puzzle-date-game-reset.zip");
const extensionFiles = ["manifest.json", "background.js", "content.js"];

await mkdir(outputDirectory, { recursive: true });
await rm(outputFile, { force: true });

const result = spawnSync(
  "zip",
  ["-X", "-j", outputFile, ...extensionFiles],
  {
    cwd: extensionDirectory,
    encoding: "utf8",
  },
);

if (result.error) {
  throw new Error(`Could not run the macOS zip utility: ${result.error.message}`);
}

if (result.status !== 0) {
  throw new Error(
    `Extension packaging failed with exit code ${result.status}:\n${result.stderr}`,
  );
}

console.log(`Created ${path.relative(projectRoot, outputFile)}`);
