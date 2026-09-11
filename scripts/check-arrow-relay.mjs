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
  handler({ altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, defaultPrevented: false, target: new StubElement(), ...event });
  return posted;
};

const arrow = (key) => ({ key });

// Forwards unhandled arrow keys to the parent frame.
for (const key of ["ArrowLeft", "ArrowRight"]) {
  assert.deepEqual(run(arrow(key)), [[
    { source: "puzzle-date-extension", type: "PUZZLE_DATE_ARROW_KEY", key },
    "*",
  ]]);
}

// Leaves everything else to the game.
assert.deepEqual(run(arrow("ArrowUp")), []);
assert.deepEqual(run({ key: "a" }), []);
assert.deepEqual(run({ ...arrow("ArrowLeft"), defaultPrevented: true }), []);
assert.deepEqual(run({ ...arrow("ArrowLeft"), ctrlKey: true }), []);
assert.deepEqual(run({ ...arrow("ArrowLeft"), metaKey: true }), []);
assert.deepEqual(run({ ...arrow("ArrowLeft"), altKey: true }), []);
assert.deepEqual(run({ ...arrow("ArrowLeft"), shiftKey: true }), []);
assert.deepEqual(run({ ...arrow("ArrowRight"), target: new StubElement({ tag: "input" }) }), []);
assert.deepEqual(run({ ...arrow("ArrowRight"), target: new StubElement({ tag: "textarea" }) }), []);
assert.deepEqual(run({ ...arrow("ArrowRight"), target: new StubElement({ tag: "select" }) }), []);
assert.deepEqual(run({ ...arrow("ArrowRight"), target: new StubElement({ isContentEditable: true }) }), []);

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
