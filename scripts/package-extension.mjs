import { copyFile, mkdir, mkdtemp, rm, utimes } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const extensionDirectory = path.join(projectRoot, "chrome-extension");
const outputDirectory = path.join(projectRoot, "public", "downloads");
const outputFile = path.join(outputDirectory, "puzzle-date-game-reset.zip");
const extensionFiles = [
  "manifest.json",
  "background.js",
  "content.js",
  "rules.json",
];

const validation = spawnSync(process.execPath, ["scripts/validate-extension.mjs"], {
  cwd: projectRoot,
  encoding: "utf8",
});

if (validation.status !== 0) {
  throw new Error(`Extension validation failed:\n${validation.stderr || validation.stdout}`);
}

await mkdir(outputDirectory, { recursive: true });
await rm(outputFile, { force: true });

const stagingDirectory = await mkdtemp(path.join(os.tmpdir(), "puzzle-date-extension-"));
const fixedTimestamp = new Date("2020-01-01T00:00:00Z");

for (const file of extensionFiles) {
  const stagedFile = path.join(stagingDirectory, file);
  await copyFile(path.join(extensionDirectory, file), stagedFile);
  await utimes(stagedFile, fixedTimestamp, fixedTimestamp);
}

const result = spawnSync(
  "zip",
  ["-X", "-j", outputFile, ...extensionFiles],
  {
    cwd: stagingDirectory,
    encoding: "utf8",
  },
);

await rm(stagingDirectory, { recursive: true, force: true });

if (result.error) {
  throw new Error(`Could not run the macOS zip utility: ${result.error.message}`);
}

if (result.status !== 0) {
  throw new Error(
    `Extension packaging failed with exit code ${result.status}:\n${result.stderr}`,
  );
}

console.log(`Created ${path.relative(projectRoot, outputFile)}`);
