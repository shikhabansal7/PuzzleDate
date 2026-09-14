// Runs captureStorageSnapshot / restoreStorageSnapshot from
// chrome-extension/background.js against a stub localStorage and checks that a
// Fresh Start puts the game's storage back exactly as it was before the day's
// play — whatever the game happened to name its keys.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../chrome-extension/background.js", import.meta.url),
  "utf8",
);
const capture = source.match(
  /const captureStorageSnapshot = \(snapshotKey, dayKey\) => \{[\s\S]*?\n\};/,
)[0];
const restore = source.match(
  /const restoreStorageSnapshot = \(snapshotKey, dayKey\) => \{[\s\S]*?\n\};/,
)[0];

// Data lives in own properties and the API on the prototype, so
// Object.keys(localStorage) lists the stored keys the way the real one does.
class StorageStub {
  constructor(entries = {}) {
    Object.assign(this, entries);
  }
  getItem(key) {
    return Object.prototype.hasOwnProperty.call(this, key) ? this[key] : null;
  }
  setItem(key, value) {
    this[key] = String(value);
  }
  removeItem(key) {
    delete this[key];
  }
}

const SNAPSHOT_KEY = "__puzzleDateSnapshot";
const load = (localStorage) =>
  new Function(
    "localStorage",
    `${capture}\n${restore}\nreturn { captureStorageSnapshot, restoreStorageSnapshot };`,
  )(localStorage);

const entries = (stub) => ({ ...stub });
const withoutSnapshot = (stub) => {
  const { [SNAPSHOT_KEY]: _snapshot, ...rest } = entries(stub);
  return rest;
};

// A whole day: arrive mid-settings, play, then ask for a fresh start.
{
  const stub = new StorageStub({
    stats: '{"played":12}',
    tutorialSeen: "true",
    theme: "dark",
    "daily-2026-09-15": '{"guesses":[]}',
  });
  const before = withoutSnapshot(stub);
  const { captureStorageSnapshot, restoreStorageSnapshot } = load(stub);

  assert.deepEqual(captureStorageSnapshot(SNAPSHOT_KEY, "2026-09-15"), {
    ok: true,
    captured: true,
  });
  assert.deepEqual(
    JSON.parse(stub.getItem(SNAPSHOT_KEY)).data,
    before,
    "snapshot must record the pre-play storage",
  );

  // The game plays: a new key appears, one changes, one is dropped.
  stub.setItem("daily-2026-09-15", '{"guesses":["CRANE","SLATE"],"won":true}');
  stub.setItem("streak", "4");
  stub.setItem("stats", '{"played":13}');
  stub.removeItem("tutorialSeen");

  assert.deepEqual(restoreStorageSnapshot(SNAPSHOT_KEY, "2026-09-15"), {
    ok: true,
    reloadFromParent: true,
  });
  assert.deepEqual(
    withoutSnapshot(stub),
    before,
    "restore must undo additions, edits and deletions alike",
  );
  assert.ok(stub.getItem(SNAPSHOT_KEY), "the snapshot itself must survive a restore");
}

// The snapshot never records itself, or a restore would nest forever.
{
  const stub = new StorageStub({ a: "1" });
  const { captureStorageSnapshot } = load(stub);
  captureStorageSnapshot(SNAPSHOT_KEY, "2026-09-15");
  captureStorageSnapshot(SNAPSHOT_KEY, "2026-09-16");
  assert.deepEqual(JSON.parse(stub.getItem(SNAPSHOT_KEY)).data, { a: "1" });
}

// Write once per puzzle day: a re-capture mid-session would bake today's play
// into the baseline and make Fresh Start a no-op.
{
  const stub = new StorageStub({ guesses: "[]" });
  const { captureStorageSnapshot, restoreStorageSnapshot } = load(stub);
  captureStorageSnapshot(SNAPSHOT_KEY, "2026-09-15");
  stub.setItem("guesses", '["CRANE"]');
  assert.deepEqual(captureStorageSnapshot(SNAPSHOT_KEY, "2026-09-15"), {
    ok: true,
    captured: false,
  });
  restoreStorageSnapshot(SNAPSHOT_KEY, "2026-09-15");
  assert.equal(stub.getItem("guesses"), "[]");
}

// A new day re-baselines, so yesterday's finished game is never restored over
// today's puzzle.
{
  const stub = new StorageStub({ guesses: '["CRANE"]' });
  const { captureStorageSnapshot } = load(stub);
  captureStorageSnapshot(SNAPSHOT_KEY, "2026-09-15");
  stub.setItem("guesses", '["SLATE"]');
  assert.deepEqual(captureStorageSnapshot(SNAPSHOT_KEY, "2026-09-16"), {
    ok: true,
    captured: true,
  });
  assert.deepEqual(JSON.parse(stub.getItem(SNAPSHOT_KEY)).data, {
    guesses: '["SLATE"]',
  });
}

// Nothing to restore is reported, not silently treated as success.
for (const [name, stored, dayKey] of [
  ["no snapshot", undefined, "2026-09-15"],
  ["malformed snapshot", "{not json", "2026-09-15"],
  ["snapshot without data", '{"day":"2026-09-15"}', "2026-09-15"],
  ["snapshot from another day", '{"day":"2026-09-14","data":{}}', "2026-09-15"],
]) {
  const stub = new StorageStub(stored === undefined ? {} : { [SNAPSHOT_KEY]: stored });
  const { restoreStorageSnapshot } = load(stub);
  const result = restoreStorageSnapshot(SNAPSHOT_KEY, dayKey);
  assert.equal(result.ok, false, `${name} must not report success`);
  assert.equal(typeof result.error, "string", `${name} must explain itself`);
}

// An archived puzzle and the live daily keep separate baselines, so a Fresh
// Start on one cannot restore over the other.
{
  const stub = new StorageStub({ "arc_en1_2026-09-01_hints": "3" });
  const { captureStorageSnapshot, restoreStorageSnapshot } = load(stub);
  captureStorageSnapshot(SNAPSHOT_KEY, "2026-09-01");
  assert.equal(restoreStorageSnapshot(SNAPSHOT_KEY, "2026-09-15").ok, false);
  assert.equal(restoreStorageSnapshot(SNAPSHOT_KEY, "2026-09-01").ok, true);
}

console.log("Snapshot reset restores pre-play storage without a per-game key list.");
