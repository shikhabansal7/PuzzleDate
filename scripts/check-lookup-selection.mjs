// Runs forwardLookupSelection from chrome-extension/background.js against a
// stub frame and checks it only hijacks the context menu when there is a
// sensible selection to look up.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../chrome-extension/background.js", import.meta.url),
  "utf8",
);
const body = source.match(/const forwardLookupSelection = \(\) => \{[\s\S]*?\n\};/)[0];

const run = (selection) => {
  const posted = [];
  let prevented = false;
  let handler;
  const documentStub = { documentElement: { dataset: {} } };
  const windowStub = {
    addEventListener: (type, fn) => {
      assert.equal(type, "contextmenu");
      handler = fn;
    },
    getSelection: () => ({ toString: () => selection }),
    parent: { postMessage: (message) => posted.push(message) },
  };
  const factory = new Function(
    "document", "window",
    `${body}\nreturn forwardLookupSelection;`,
  );
  factory(documentStub, windowStub)();
  handler({ preventDefault: () => { prevented = true; } });
  return { posted, prevented };
};

const message = (text) => ({
  source: "puzzle-date-extension",
  type: "PUZZLE_DATE_LOOKUP_SELECTION",
  text,
});

// A real selection is relayed, and the game's own menu gives way.
assert.deepEqual(run("cleave"), { posted: [message("cleave")], prevented: true });

// Whitespace is collapsed so a multi-line drag still reads as one phrase.
assert.deepEqual(
  run("  full   circle\nfriday "),
  { posted: [message("full circle friday")], prevented: true },
);

// No selection: the browser's own context menu must be left alone.
for (const empty of ["", "   ", "\n\t "]) {
  assert.deepEqual(run(empty), { posted: [], prevented: false }, `hijacked menu for ${JSON.stringify(empty)}`);
}

// A whole paragraph is not a dictionary lookup; leave the menu alone.
assert.deepEqual(run("x".repeat(61)), { posted: [], prevented: false });
assert.equal(run("x".repeat(60)).posted.length, 1, "60 characters should still be looked up");

// Re-injection into the same frame must not double-register the listener.
{
  let registrations = 0;
  const documentStub = { documentElement: { dataset: {} } };
  const windowStub = {
    addEventListener: () => { registrations += 1; },
    getSelection: () => ({ toString: () => "" }),
    parent: { postMessage: () => {} },
  };
  const factory = new Function("document", "window", `${body}\nreturn forwardLookupSelection;`);
  const forward = factory(documentStub, windowStub);
  forward();
  forward();
  assert.equal(registrations, 1);
}

console.log("Selection lookup relays real selections and leaves empty menus alone.");
