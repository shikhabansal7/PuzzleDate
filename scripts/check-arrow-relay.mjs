// Exercises forwardArrowKeys from chrome-extension/background.js against a stub DOM.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../chrome-extension/background.js", import.meta.url),
  "utf8",
);
const body = source.match(/const forwardArrowKeys = \(\) => \{[\s\S]*?\n\};/)[0];

class StubElement {
  constructor({ isContentEditable = false, tag = "div" } = {}) {
    this.isContentEditable = isContentEditable;
    this.tag = tag;
  }
  matches(selector) {
    return selector.split(",").map((s) => s.trim()).includes(this.tag);
  }
}

const run = (event) => {
  const posted = [];
  let prevented = false;
  let handler;
  const sandbox = {
    document: { documentElement: { dataset: {} } },
    HTMLElement: StubElement,
    window: {
      addEventListener: (type, fn) => {
        assert.equal(type, "keydown");
        handler = fn;
      },
      parent: { postMessage: (message, origin) => posted.push([message, origin]) },
    },
  };
  const factory = new Function(
    "document", "HTMLElement", "window",
    `${body}\nreturn forwardArrowKeys;`,
  );
  factory(sandbox.document, sandbox.HTMLElement, sandbox.window)();
  handler({
    altKey: false, ctrlKey: false, metaKey: false, shiftKey: false,
    defaultPrevented: false, target: new StubElement(),
    preventDefault: () => { prevented = true; },
    ...event,
  });
  return { posted, prevented };
};

// Navigation is the command chord now, not a bare arrow.
const chord = (key, modifier = "metaKey") => ({ key, [modifier]: true });
const relayed = (key) => [[
  { source: "puzzle-date-extension", type: "PUZZLE_DATE_ARROW_KEY", key },
  "*",
]];

// Command (macOS) and Control (elsewhere) both navigate.
for (const key of ["ArrowLeft", "ArrowRight"]) {
  for (const modifier of ["metaKey", "ctrlKey"]) {
    assert.deepEqual(
      run(chord(key, modifier)),
      { posted: relayed(key), prevented: true },
      `${modifier}+${key} should navigate`,
    );
  }
}

// A bare arrow now belongs to the game, and must not be swallowed.
for (const key of ["ArrowLeft", "ArrowRight"]) {
  assert.deepEqual(
    run({ key }),
    { posted: [], prevented: false },
    `bare ${key} must reach the game`,
  );
}

// Leaves everything else to the game.
assert.deepEqual(run(chord("ArrowUp")), { posted: [], prevented: false });
assert.deepEqual(run({ key: "a", metaKey: true }), { posted: [], prevented: false });
assert.deepEqual(run({ ...chord("ArrowLeft"), defaultPrevented: true }), { posted: [], prevented: false });
assert.deepEqual(run({ ...chord("ArrowLeft"), altKey: true }), { posted: [], prevented: false });
assert.deepEqual(run({ ...chord("ArrowLeft"), shiftKey: true }), { posted: [], prevented: false });
for (const tag of ["input", "textarea", "select"]) {
  assert.deepEqual(
    run({ ...chord("ArrowRight"), target: new StubElement({ tag }) }),
    { posted: [], prevented: false },
    `${tag} should keep the chord`,
  );
}
assert.deepEqual(
  run({ ...chord("ArrowRight"), target: new StubElement({ isContentEditable: true }) }),
  { posted: [], prevented: false },
);

// Double injection into the same frame must not double-register.
{
  let registrations = 0;
  const documentStub = { documentElement: { dataset: {} } };
  const windowStub = {
    addEventListener: () => { registrations += 1; },
    parent: { postMessage: () => {} },
  };
  const factory = new Function(
    "document", "HTMLElement", "window",
    `${body}\nreturn forwardArrowKeys;`,
  );
  const forward = factory(documentStub, StubElement, windowStub);
  forward();
  forward();
  assert.equal(registrations, 1);
}

console.log("Arrow-key relay guards behave correctly.");
