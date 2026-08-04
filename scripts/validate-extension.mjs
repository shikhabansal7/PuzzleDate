import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const extensionDirectory = path.join(projectRoot, "chrome-extension");
const fail = (message) => {
  throw new Error(`Extension validation failed: ${message}`);
};
const equalSet = (actual, expected) =>
  actual.length === expected.length && expected.every((value) => actual.includes(value));

const manifest = JSON.parse(await readFile(path.join(extensionDirectory, "manifest.json"), "utf8"));
const rules = JSON.parse(await readFile(path.join(extensionDirectory, "rules.json"), "utf8"));

if (manifest.manifest_version !== 3) fail("manifest_version must be 3");
if (manifest.version !== "1.0.6") fail("release version must be 1.0.6");
if (!manifest.permissions?.includes("declarativeNetRequest")) {
  fail("declarativeNetRequest permission is required");
}

const registrations = manifest.declarative_net_request?.rule_resources ?? [];
if (
  registrations.length !== 1 ||
  registrations[0].id !== "puzzle_date_game_frames" ||
  registrations[0].enabled !== true ||
  registrations[0].path !== "rules.json"
) {
  fail("manifest must register the enabled rules.json ruleset");
}

if (!Array.isArray(rules) || rules.length !== 1) fail("rules.json must contain one rule");
const [rule] = rules;
if (rule.action?.type !== "modifyHeaders") fail("rule must modify response headers");

const expectedHeaders = [
  "x-frame-options",
  "content-security-policy",
  "content-security-policy-report-only",
];
const responseHeaders = rule.action?.responseHeaders ?? [];
if (
  responseHeaders.length !== expectedHeaders.length ||
  !equalSet(responseHeaders.map(({ header }) => header), expectedHeaders) ||
  responseHeaders.some(({ operation, value }) => operation !== "remove" || value !== undefined)
) {
  fail("rule may only remove the three approved framing headers");
}

if (!equalSet(rule.condition?.resourceTypes ?? [], ["sub_frame"])) {
  fail("rule must be limited to sub_frame requests");
}
if (
  !equalSet(rule.condition?.initiatorDomains ?? [], [
    "shikhabansal7.github.io",
    "localhost",
  ])
) {
  fail("rule must be limited to Puzzle Date and localhost initiators");
}

const pageSource = await readFile(path.join(projectRoot, "app", "page.tsx"), "utf8");
const puzzleList = pageSource.match(/const puzzles: Puzzle\[\] = \[([\s\S]*?)\n\];/)?.[1];
if (!puzzleList) fail("could not read the configured puzzle list");
const configuredDomains = [...puzzleList.matchAll(/url: "(https:[^"]+)"/g)]
  .map(([, url]) => new URL(url).hostname.replace(/^www\./, ""));
if (!equalSet(rule.condition?.requestDomains ?? [], configuredDomains)) {
  fail("requestDomains must exactly cover all configured game domains");
}

const backgroundSource = await readFile(path.join(extensionDirectory, "background.js"), "utf8");
const contentSource = await readFile(path.join(extensionDirectory, "content.js"), "utf8");
for (const required of [
  "CUSTOM_GAMES_RULE_ID = 1000",
  "MAX_CUSTOM_HOSTS = 100",
  "updateDynamicRules",
  "removeRuleIds: [CUSTOM_GAMES_RULE_ID]",
  'initiatorDomains: [...PUZZLE_DATE_HOSTS]',
  'resourceTypes: ["sub_frame"]',
  'message.strategy === "custom-clear-all"',
  "localStorage.clear()",
  "getDynamicRules",
]) {
  if (!backgroundSource.includes(required)) fail(`background is missing ${required}`);
}
if (/sessionStorage\.clear|indexedDB|cookies|caches\.delete/.test(backgroundSource)) {
  fail("custom reset may only clear localStorage");
}
for (const required of [
  "PUZZLE_DATE_REGISTER_CUSTOM_GAMES",
  "PUZZLE_DATE_CUSTOM_GAMES_RESULT",
  'iframe.dataset.customGame !== "true"',
  'strategy === "custom-clear-all"',
]) {
  if (!contentSource.includes(required)) fail(`content script is missing ${required}`);
}
for (const required of [
  'resetStrategy: "custom-clear-all"',
  'data-custom-game={puzzle.custom ? "true" : undefined}',
  "setCustomFrameRevision",
]) {
  if (!pageSource.includes(required)) fail(`app is missing ${required}`);
}

for (const file of ["background.js", "content.js"]) {
  const result = spawnSync(process.execPath, ["--check", path.join(extensionDirectory, file)], {
    encoding: "utf8",
  });
  if (result.status !== 0) fail(`${file} has invalid JavaScript syntax: ${result.stderr}`);
}

console.log("Extension manifest, rules, scope, domains, headers, and scripts are valid.");
