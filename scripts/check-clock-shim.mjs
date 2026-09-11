// Runs applyClockShim from chrome-extension/background.js against stubs, then
// replays each game's real day-index formula through the shimmed Date to prove
// the archived puzzle is what the game would compute.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../chrome-extension/background.js", import.meta.url),
  "utf8",
);
const body = source.match(/const applyClockShim = \(isoDate\) => \{[\s\S]*?\n\};/)[0];

const shimmedDate = (isoDate) => {
  const documentStub = { documentElement: { dataset: {} } };
  const windowStub = { Date };
  const factory = new Function(
    "document", "window",
    `${body}\nreturn applyClockShim;`,
  );
  factory(documentStub, windowStub)(isoDate);
  return { Date: windowStub.Date, dataset: documentStub.documentElement.dataset };
};

const TARGET = "2026-09-01";
const { Date: D, dataset } = shimmedDate(TARGET);

// The shimmed clock reports the target calendar day, in local time.
const localDay = (d) =>
  [d.getFullYear(), String(d.getMonth() + 1).padStart(2, "0"), String(d.getDate()).padStart(2, "0")].join("-");
assert.equal(localDay(new D()), TARGET);
assert.equal(localDay(new D(D.now())), TARGET);
assert.equal(dataset.puzzleDateClockShim, TARGET);

// Explicit arguments must be left alone, or saved timestamps get corrupted.
assert.equal(new D(0).getTime(), 0);
assert.equal(new D("2020-05-06T00:00:00Z").toISOString(), "2020-05-06T00:00:00.000Z");
assert.equal(D.parse("2020-05-06T00:00:00Z"), 1588723200000);
assert.equal(D.UTC(2020, 4, 6), 1588723200000);

// Anything that inspects the constructor must still behave.
assert.ok(new D() instanceof Date);
assert.equal(typeof D(), "string");

// Re-injection into the same frame must not stack another offset, including
// when it lands before <html> exists and the dataset marker cannot be written.
for (const documentStub of [
  { documentElement: { dataset: {} } },
  { documentElement: null },
]) {
  const windowStub = { Date };
  const factory = new Function("document", "window", `${body}\nreturn applyClockShim;`);
  const apply = factory(documentStub, windowStub);
  apply(TARGET);
  const once = windowStub.Date.now();
  apply(TARGET);
  assert.ok(
    Math.abs(windowStub.Date.now() - once) < 1000,
    "second injection shifted the clock again",
  );
  assert.equal(localDay(new windowStub.Date()), TARGET);
}

// A malformed date must leave the real clock untouched.
{
  const windowStub = { Date };
  const factory = new Function("document", "window", `${body}\nreturn applyClockShim;`);
  factory({ documentElement: { dataset: {} } }, windowStub)("not-a-date");
  assert.equal(windowStub.Date, Date);
}

// Each game's real formula, read from its shipped source, must land on the day
// that matches the target date rather than today.
const days = (from, to) => Math.round((to - from) / 86400000);
const cases = {
  // Verticle: counts days from new Date(2022, 0) to today.
  verticle: (Now) => {
    let t = new Date(2022, 0);
    const r = new Now();
    r.setHours(0, 0, 0, 0);
    let n = 0;
    for (; t < r; n++) t.setDate(t.getDate() + 1);
    return n;
  },
  // FoxiMax: Math.floor((Date.now() - tzOffset) / 86400000)
  foximax: (Now) =>
    Math.floor((Now.now() - new Now().getTimezoneOffset() * 60000) / 86400000),
  // Unwordle: differenceInDays(new Date(), new Date(2022, 0, 19))
  unwordle: (Now) => days(new Date(2022, 0, 19), new Now()),
  // Waffle: number from the 2022-02-13 epoch.
  waffle: (Now) => days(new Date("2022-02-13T00:00:00.000Z"), new Now()),
};

const realToday = new Date();
for (const [game, formula] of Object.entries(cases)) {
  const shifted = formula(D);
  const live = formula(Date);
  const expectedGap = days(new Date(`${TARGET}T00:00:00`), new Date(
    realToday.getFullYear(), realToday.getMonth(), realToday.getDate(),
  ));
  assert.ok(shifted < live, `${game}: shimmed index should be earlier than today's`);
  assert.equal(live - shifted, expectedGap, `${game}: index moved by the wrong number of days`);
}

console.log("Clock shim shifts every verified game formula to the target date.");
