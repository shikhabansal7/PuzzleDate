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
if (manifest.version !== "1.0.20") fail("release version must be 1.0.20");
if (manifest.content_scripts?.[0]?.run_at !== "document_start") {
  fail("app content script must run at document_start to minimize the frame-policy race");
}
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
for (const [sourceName, source] of [["content", contentSource], ["background", backgroundSource]]) {
  if (!source.includes('"connections-current"')) {
    fail(`${sourceName} is missing the Connections reset strategy`);
  }
}
if (!backgroundSource.includes('"connections-current": "https://www.nytimes.com"')) {
  fail("Connections reset must be restricted to the New York Times origin");
}
const connectionsReset = backgroundSource.match(
  /if \(strategy === "connections-current"\) \{([\s\S]*?)\n  \} else if/,
)?.[1];
if (!connectionsReset) fail("Connections reset implementation is missing");
if (!connectionsReset.includes("return { ok: true, reloadFromParent: true }")) {
  fail("Connections reset must ask the Puzzle Date parent to reload its iframe");
}
if (connectionsReset.includes("window.location.reload")) {
  fail("Connections reset must not reload from inside the child frame");
}
if (/localStorage\.(?:clear|removeItem)\(/.test(connectionsReset)) {
  fail("Connections reset must not remove or clear New York Times storage");
}
for (const required of [
  'const key = "games-state-connections/ANON"',
  'const storedValue = localStorage.getItem(key)',
  "state = JSON.parse(storedValue)",
  "localStorage.setItem(key, JSON.stringify({ ...state, states: resetStates }))",
  "...state",
  "...savedState",
  "...savedState.data",
  "puzzleComplete: false",
  "puzzleWon: false",
  "mistakes: 0",
  "guesses: []",
  "solvedCategories: []",
  'error: "Connections game state is missing."',
  'error: "Connections game state is malformed."',
  "Array.isArray(state.states)",
  "Array.isArray(savedState)",
  "Array.isArray(savedState.data)",
]) {
  if (!connectionsReset.includes(required)) {
    fail(`Connections reset is missing safe state mutation: ${required}`);
  }
}
if (!/data:\s*\{\s*\.\.\.savedState\.data,\s*puzzleComplete: false,\s*puzzleWon: false,\s*mistakes: 0,\s*guesses: \[\],\s*solvedCategories: \[\],\s*\}/.test(connectionsReset)) {
  fail("Connections reset must change exactly its five approved data fields");
}
for (const required of [
  "const pendingConnectionsPlay = new Set()",
  'pendingConnectionsPlay.add(`${tabId}:${target.frameId}`)',
  "pendingConnectionsPlay.has(pendingKey)",
  'url === "https://www.nytimes.com/games/connections"',
  'url.startsWith("https://www.nytimes.com/games/connections?")',
  'url.startsWith("https://www.nytimes.com/games/connections#")',
  "pendingConnectionsPlay.delete(pendingKey)",
  "result?.ok && message.strategy === \"connections-current\"",
  'document.querySelector(\'[data-testid="moment-btn-play"]\')',
  "button instanceof HTMLButtonElement",
  '=== "Play"',
  "button.click()",
  "new MutationObserver(clickExactPlay)",
  "observer.disconnect()",
  "setTimeout(cleanup, 10000)",
  "delete document.documentElement?.dataset[marker]",
]) {
  if (!backgroundSource.includes(required)) {
    fail(`Connections Play recovery is missing ${required}`);
  }
}
if (/document\.querySelector(?:All)?\(\s*[`'"]button(?:\b|[.#[:])/i.test(backgroundSource)) {
  fail("Connections Play recovery must not query broad button selectors");
}
for (const required of [
  "const forwardArrowKeys = ()",
  'const marker = "puzzleDateArrowForwarding"',
  'event.key !== "ArrowLeft" && event.key !== "ArrowRight"',
  "if (event.defaultPrevented) return",
  "event.altKey || event.ctrlKey || event.metaKey || event.shiftKey",
  "target.isContentEditable",
  'target.matches("input, textarea, select")',
  "window.parent.postMessage",
  'source: "puzzle-date-extension"',
  'type: "PUZZLE_DATE_ARROW_KEY"',
  "func: forwardArrowKeys",
]) {
  if (!backgroundSource.includes(required)) {
    fail(`arrow-key relay is missing ${required}`);
  }
}
if (/forwardArrowKeys[\s\S]*?window\.parent\.postMessage[\s\S]{0,200}?key: event\.key/.test(backgroundSource) === false) {
  fail("arrow-key relay must forward only the pressed arrow key");
}

for (const required of [
  'params.get("mode") === "archive"',
  "`arc_${language}${level}_${archiveDate}_`",
  "/^\\d{4}-\\d{2}-\\d{2}$/.test(archiveDate)",
]) {
  if (!backgroundSource.includes(required)) {
    fail(`Word 500 archive reset is missing ${required}`);
  }
}

for (const required of [
  "const forwardLookupSelection = ()",
  'const marker = "puzzleDateLookupSelection"',
  'window.addEventListener("contextmenu"',
  "window.getSelection()?.toString()",
  "text.length > 60",
  'type: "PUZZLE_DATE_LOOKUP_SELECTION"',
  "func: forwardLookupSelection",
]) {
  if (!backgroundSource.includes(required)) {
    fail(`selection lookup relay is missing ${required}`);
  }
}
// An empty selection must leave the browser's own menu alone.
if (!/if \(!text \|\| text\.length > 60\) return;[\s\S]{0,200}?event\.preventDefault\(\)/.test(backgroundSource)) {
  fail("selection lookup must only suppress the context menu when text is selected");
}

for (const required of [
  "const applyClockShim = (isoDate)",
  'const marker = "puzzleDateClockShim"',
  "if (window[marker]) return",
  "const RealDate = Date",
  "target.getTime() - startOfToday.getTime()",
  "ShimDate.prototype = RealDate.prototype",
  "Object.setPrototypeOf(ShimDate, RealDate)",
  "window.Date = ShimDate",
  "chrome.webNavigation.onCommitted.addListener",
  "injectImmediately: true",
  "func: applyClockShim",
  "CLOCK_SHIM_ORIGINS.has(origin)",
  'message?.type === "SET_PUZZLE_DATE"',
  "isPastIsoDate(isoDate)",
  "puzzleDateByTab.delete(tabId)",
]) {
  if (!backgroundSource.includes(required)) {
    fail(`clock shim is missing ${required}`);
  }
}
if (!/chrome\.webNavigation\.onCommitted[\s\S]{0,200}?frameId === 0\) return/.test(backgroundSource)) {
  fail("clock shim must never run in a top-level frame");
}

// The shim rewrites Date inside a game, so its origins must be games Puzzle
// Date already frames — never an arbitrary site.
const shimOrigins = backgroundSource.match(/const CLOCK_SHIM_ORIGINS = new Set\(\[([\s\S]*?)\]\);/)?.[1];
if (!shimOrigins) fail("background is missing CLOCK_SHIM_ORIGINS");
const shimHosts = [...shimOrigins.matchAll(/"(https:\/\/[^"]+)"/g)]
  .map(([, origin]) => new URL(origin).hostname.replace(/^www\./, ""));
for (const host of shimHosts) {
  if (!configuredDomains.includes(host)) {
    fail(`clock shim origin ${host} is not a configured game domain`);
  }
}
for (const forbidden of ["fullcirclefriday.com", "puzzlitapp.com", "nytimes.com"]) {
  if (shimHosts.includes(forbidden)) {
    fail(`${forbidden} does not derive its puzzle from the client clock`);
  }
}

// Every archive URL the app can point a frame at must stay on that game's
// already-approved origin, or the reset origin checks would reject it.
const archiveUrls = pageSource.match(/const ARCHIVE_URLS[\s\S]*?\n\};/)?.[0];
if (!archiveUrls) fail("app is missing the ARCHIVE_URLS map");
for (const [, origin] of archiveUrls.matchAll(/`(https:\/\/[^/`$]+)/g)) {
  if (!configuredDomains.includes(new URL(origin).hostname.replace(/^www\./, ""))) {
    fail(`archive URL ${origin} is not a configured game domain`);
  }
}

const readStringArray = (source, constantName) => {
  const body = source.match(new RegExp(`const ${constantName} = \\[([\\s\\S]*?)\\n\\];`))?.[1];
  if (!body) fail(`background is missing ${constantName}`);
  return [...body.matchAll(/"([^"]+)"/g)].map(([, value]) => value);
};
const expectedAdDomains = [
  "2mdn.net",
  "adthrive.com",
  "adnxs.com",
  "adsrvr.org",
  "amazon-adsystem.com",
  "criteo.com",
  "criteo.net",
  "doubleclick.net",
  "googleadservices.com",
  "googlesyndication.com",
  "npttech.com",
  "openx.net",
  "outbrain.com",
  "pubmatic.com",
  "raptivecdn.com",
  "rubiconproject.com",
  "taboola.com",
  "videoplayerhub.com",
  "media.net",
  "vntsm.com",
  "ezojs.com",
  "lngtd.com",
  "fuseplatform.net",
  "33across.com",
  "3lift.com",
  "4dex.io",
  "a-mo.net",
  "a-mx.com",
  "ad-delivery.net",
  "ad.gt",
  "adtrafficquality.google",
  "atmtd.com",
  "ay.delivery",
  "btloader.com",
  "casalemedia.com",
  "ccgateway.net",
  "connectad.io",
  "cootlogix.com",
  "crwdcntrl.net",
  "dotomi.com",
  "ezodn.com",
  "ezoic.com",
  "ezoic.net",
  "fastclick.net",
  "flashtalking.com",
  "gumgum.com",
  "hadronid.net",
  "id5-sync.com",
  "imrworldwide.com",
  "ingage.tech",
  "kargo.com",
  "kueezrtb.com",
  "liadm.com",
  "marphezis.com",
  "nexx360.io",
  "omnitagjs.com",
  "onetag-sys.com",
  "pghub.io",
  "postrelease.com",
  "privacymanager.io",
  "pubgw.yahoo.com",
  "quantcount.com",
  "quantserve.com",
  "raptive.com",
  "richaudience.com",
  "rkdms.com",
  "rlcdn.com",
  "scorecardresearch.com",
  "seedtag.com",
  "servenobid.com",
  "sharethrough.com",
  "smartadserver.com",
  "smilewanted.com",
  "teads.tv",
  "trustedstack.com",
  "venatusmedia.com",
  "vntsm.io",
  "yellowblue.io",
];
if (!equalSet(readStringArray(backgroundSource, "AD_SERVING_DOMAINS"), expectedAdDomains)) {
  fail("ad blocking must use exactly the reviewed ad-serving domains");
}
if (!equalSet(readStringArray(backgroundSource, "AD_BLOCK_RESOURCE_TYPES"), [
  "image",
  "media",
  "script",
  "sub_frame",
  "xmlhttprequest",
])) {
  fail("ad blocking must use only the approved resource types");
}
for (const selector of [
  '.pz-section.pz-section-filled.pz-ad-box.pz-desktop-only[data-testid="ad-top"]',
  '.pz-section.pz-section-filled.pz-ad-box.pz-desktop-only[data-testid="ad-bottom"]',
  '[class*="adthrive" i]',
  '[id*="adthrive" i]',
  '[data-adthrive]',
  'iframe[src*="videoplayerhub.com"]',
  '[class*="raptive" i]',
  '[id*="raptive" i]',
  '.adbox',
  '.game-adbox',
  '.top-banner-container',
  '.bottom-banner-container',
  '[data-type="desktop-adhesion"]',
  '[id^="ezoic-pub-ad-placeholder-"]',
  '.Advertisement',
  '[data-fuse]',
  '#leaderboard-ad',
  '#lhs-ad',
  '#rhs-ad',
  '.promo-banner',
  '.promo-side',
]) {
  if (!backgroundSource.includes(selector)) {
    fail(`cosmetic ad blocking is missing the reviewed selector ${selector}`);
  }
}
const expectedAdUrlFilters = [
  "||fourbythree-stats.hankmt.workers.dev/ads",
  "||www.nytimes.com/ads/",
];
if (!equalSet(readStringArray(backgroundSource, "AD_BLOCK_URL_FILTERS"), expectedAdUrlFilters)) {
  fail("ad blocking must use exactly the reviewed path filters");
}
for (const required of [
  "AD_BLOCK_RULES_PER_TAB = 3",
  "AD_BLOCK_RULE_ID_BASE = CUSTOM_GAMES_RULE_ID + 1",
  "MAX_AD_BLOCK_TAB_ID",
  "2147483647 - AD_BLOCK_RULE_ID_BASE - (AD_BLOCK_RULES_PER_TAB - 1)",
  "adBlockRuleIdsForTab",
  "AD_BLOCK_RULE_ID_BASE + tabId * AD_BLOCK_RULES_PER_TAB",
  "removeRuleIds: ruleIds",
  "...AD_BLOCK_URL_FILTERS.map",
  "urlFilter,",
  "ruleIds[index + 1]",
]) {
  if (!backgroundSource.includes(required)) {
    fail(`path-scoped ad rules are missing ${required}`);
  }
}
const customGamesRuleId = 1000;
const adBlockRulesPerTab = 3;
const adBlockRuleIdBase = customGamesRuleId + 1;
const maximumRuleId = 2147483647;
const maximumAdBlockTabId = Math.floor(
  (maximumRuleId - adBlockRuleIdBase - (adBlockRulesPerTab - 1)) /
    adBlockRulesPerTab,
);
const generatedAdBlockRuleIds = (tabId) =>
  Array.from(
    { length: adBlockRulesPerTab },
    (_, index) => adBlockRuleIdBase + tabId * adBlockRulesPerTab + index,
  );
const representativeTabIds = [0, 1, 333, maximumAdBlockTabId];
const representativeRuleIds = representativeTabIds.flatMap(generatedAdBlockRuleIds);
if (
  representativeRuleIds.some(
    (ruleId) =>
      !Number.isInteger(ruleId) ||
      ruleId <= customGamesRuleId ||
      ruleId > maximumRuleId,
  ) ||
  new Set(representativeRuleIds).size !== representativeRuleIds.length
) {
  fail("generated per-tab ad rule IDs must be valid, unique, and above the custom-game rule ID");
}
if (generatedAdBlockRuleIds(333).includes(customGamesRuleId)) {
  fail("tab 333 ad rules must not collide with the custom-game rule ID");
}
if (backgroundSource.includes('"workers.dev"') || backgroundSource.includes('"nytimes.com"')) {
  fail("ad blocking must not block entire workers.dev or nytimes.com hosts");
}
// Analytics, consent gates, login providers, players and generic CDNs are not
// ads; blocking them breaks the games rather than cleaning them up.
for (const forbidden of [
  "googletagmanager.com",
  "google-analytics.com",
  "analytics.google.com",
  "googleapis.com",
  "gstatic.com",
  "google.com",
  "yahoo.com",
  "facebook.net",
  "jsdelivr.net",
  "jwplayer.com",
  "amplitude.com",
  "gatekeeperconsent.com",
  "cloudflareinsights.com",
  "iconify.design",
  "ko-fi.com",
]) {
  if (expectedAdDomains.includes(forbidden) || backgroundSource.includes(`"${forbidden}"`)) {
    fail(`ad blocking must not add the unreviewed broad service ${forbidden}`);
  }
}
if (new Set(expectedAdDomains).size !== expectedAdDomains.length) {
  fail("ad-serving domains must not contain duplicates");
}
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
  "ENABLE_PUZZLE_DATE_AD_BLOCK",
  "updateSessionRules",
  "getSessionRules",
  "AD_SERVING_DOMAINS",
  "AD_BLOCK_RESOURCE_TYPES",
  "condition: {",
  "tabIds: [tabId]",
  "chrome.tabs.onRemoved",
  "chrome.scripting.insertCSS",
  "frameId === 0",
  "isPuzzleDateSender(sender)",
]) {
  if (!backgroundSource.includes(required)) fail(`background is missing ${required}`);
}
for (const required of [
  "handleConsentUi",
  "containerSelectors",
  "privacyLabels",
  '"reject all"',
  '"decline all"',
  '"necessary only"',
  '"essential only"',
  '"continue without accepting"',
  '"do not consent"',
  "container.querySelectorAll",
  "container.querySelector(closeSelectors.join",
  "new MutationObserver",
  "observer.disconnect()",
  "12000",
  "chrome.scripting.executeScript",
  'world: "MAIN"',
]) {
  if (!backgroundSource.includes(required)) {
    fail(`consent cleanup is missing ${required}`);
  }
}
if (/sessionStorage\.(?:clear|removeItem|setItem)|indexedDB|chrome\.cookies|document\.cookie|caches\.(?:delete|open)/i.test(backgroundSource)) {
  fail("extension must not manipulate cookies or non-localStorage storage");
}
if (/\b(?:accept all|allow all|agree|i accept|i agree)\b/i.test(backgroundSource)) {
  fail("consent cleanup must not include acceptance labels or actions");
}
if (/document\.querySelectorAll\(\s*['"]button/i.test(backgroundSource)) {
  fail("consent controls must be searched only inside known containers");
}
for (const required of [
  'chrome.runtime.getManifest().version',
  'PUZZLE_DATE_EXTENSION_READY',
  'detail: { version }',
  "PUZZLE_DATE_REGISTER_CUSTOM_GAMES",
  "PUZZLE_DATE_CUSTOM_GAMES_RESULT",
  'iframe.dataset.customGame !== "true"',
  'strategy === "custom-clear-all"',
  'type: "ENABLE_PUZZLE_DATE_AD_BLOCK"',
  "response?.ok && response.reloadFromParent",
  "iframe.src = currentSrc",
]) {
  if (!contentSource.includes(required)) fail(`content script is missing ${required}`);
}
if (/cookie|consent|localStorage|sessionStorage|indexedDB|caches/i.test(contentSource)) {
  fail("content script must not manipulate cookies, consent, or browser storage");
}
for (const required of [
  'const EXPECTED_EXTENSION_VERSION = "1.0.20"',
  'resetStrategy: "connections-current"',
  'extensionHealth === "current"',
  'extensionHealth === "outdated"',
  'extension-health-light--${extensionHealth}',
  'className="visually-hidden"',
  'resetStrategy: "custom-clear-all"',
  'data-custom-game={activePuzzle.custom ? "true" : undefined}',
  "setCustomFrameRevision",
  'className="game-frame active"',
  'loading="eager"',
  'link.rel = rel',
  'link.dataset.puzzleDateHint = rel',
  'link.crossOrigin = crossOrigin',
  'link.as = as',
  'return () => hints.forEach((link) => link.remove())',
  '["http:", "https:"].includes(nextUrl.protocol)',
  "const frameRef = useRef<HTMLIFrameElement>(null)",
  "ref={frameRef}",
  'window.addEventListener("message", handleFrameArrowKey)',
  "event.source !== frameRef.current?.contentWindow",
  'message?.source !== "puzzle-date-extension"',
  'message.type === "PUZZLE_DATE_ARROW_KEY"',
  'message.key === "ArrowLeft"',
  'message.key === "ArrowRight"',
  'window.removeEventListener("message", handleFrameArrowKey)',
  'const ARCHIVE_STORAGE_KEY = "puzzle-date-archive-date"',
  "value < isoToday()",
  'type="date"',
  "max={isoToday()}",
  "src={activePuzzleUrl}",
  "puzzleUrl(nextPuzzle, archiveDate)",
  "const CLOCK_SHIM_URLS = new Set",
  'new CustomEvent("PUZZLE_DATE_SET_CLOCK"',
  "PUZZLE_DATE_SET_CLOCK_RESULT",
  "registeredClockDate === archiveDate",
  "setClockRevision",
  'const LOOKUP_COLLAPSED_KEY = "puzzle-date-lookup-collapsed"',
  'message.type === "PUZZLE_DATE_LOOKUP_SELECTION"',
  "runLookup(text)",
  "setLookupCollapsed",
  "aria-expanded={!lookupCollapsed}",
  "hidden={lookupCollapsed}",
]) {
  if (!pageSource.includes(required)) fail(`app is missing ${required}`);
}

// The app and the extension must agree on exactly which games get the shim.
const appShimUrls = pageSource.match(/const CLOCK_SHIM_URLS = new Set\(\[([\s\S]*?)\]\);/)?.[1];
if (!appShimUrls) fail("app is missing CLOCK_SHIM_URLS");
const appShimHosts = [...appShimUrls.matchAll(/"(https:\/\/[^"]+)"/g)]
  .map(([, url]) => new URL(url).hostname.replace(/^www\./, ""));
if (!equalSet(appShimHosts, shimHosts)) {
  fail("app and extension clock-shim games must match exactly");
}
if (pageSource.includes("framedPuzzles") || pageSource.includes("game-frame preloaded") || pageSource.includes("(preloaded)")) {
  fail("app must not create a preloaded puzzle iframe");
}
if ((pageSource.match(/<iframe\b/g) ?? []).length !== 1) {
  fail("app must render exactly one active puzzle iframe declaration");
}
if (!pageSource.includes("document.head.querySelector(selector)")) {
  fail("app must avoid duplicate next-puzzle resource hints");
}
for (const [relativePath, source] of [
  ["README.md", await readFile(path.join(projectRoot, "README.md"), "utf8")],
  ["public/extension-install.html", await readFile(path.join(projectRoot, "public", "extension-install.html"), "utf8")],
]) {
  if (!source.includes("Version 1.0.20") && !source.includes("version 1.0.20")) {
    fail(`${relativePath} must document release 1.0.20`);
  }
  if (!source.includes("without creating the next iframe")) {
    fail(`${relativePath} must explain timer-safe preload`);
  }
  if (!source.includes("audited ad blocking")) {
    fail(`${relativePath} must explain expanded audited ad blocking`);
  }
}

for (const file of ["background.js", "content.js"]) {
  const result = spawnSync(process.execPath, ["--check", path.join(extensionDirectory, file)], {
    encoding: "utf8",
  });
  if (result.status !== 0) fail(`${file} has invalid JavaScript syntax: ${result.stderr}`);
}

for (const [label, script] of [
  ["arrow-key relay", "check-arrow-relay.mjs"],
  ["clock shim", "check-clock-shim.mjs"],
  ["ad coverage", "check-ad-coverage.mjs"],
  ["selection lookup", "check-lookup-selection.mjs"],
]) {
  const result = spawnSync(
    process.execPath,
    [path.join(projectRoot, "scripts", script)],
    { encoding: "utf8" },
  );
  if (result.status !== 0) {
    fail(`${label} behaves incorrectly:\n${result.stderr || result.stdout}`);
  }
}

console.log("Extension manifest, rules, scope, domains, headers, and scripts are valid.");
