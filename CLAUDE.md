# CLAUDE.md

Guidance for Claude Code working in this repository.

## What this app is

**Puzzle Date** — a single-page web app that plays a rotation of daily word/puzzle
games in one place. It embeds each game in an iframe when possible, lets the user
step through them with ⌘/Ctrl + ← / →, and ships a companion Chrome extension (**Puzzle Date
Game Reset**) that makes embedding possible for sites that block framing, adds a
per-game "Start Over" reset, blocks ads inside embedded games, and dismisses
cookie-consent banners privately.

Deployed as a static site to **GitHub Pages** at `https://shikhabansal7.github.io/PuzzleDate/`.

## Repo layout

| Path | Role |
|---|---|
| `app/page.tsx` | The entire app. Client component, ~810 lines. All UI + state. |
| `app/globals.css` | All styling. Design + motion tokens in `:root`, one `@media (max-width: 680px)` breakpoint, one reduced-motion block. |
| `app/layout.tsx` | Next.js root layout (Geist fonts, metadata). Only used by the vinext/Cloudflare build. |
| `app/chatgpt-auth.ts` | Unused starter helper for OpenAI Sites SIWC auth headers. Not wired into Puzzle Date. |
| `pages/` | Vite entry (`index.html` + `main.tsx`) that mounts `app/page.tsx` as a plain SPA. **This is what actually ships.** |
| `chrome-extension/` | MV3 extension source: `manifest.json`, `background.js`, `content.js`, `rules.json`. |
| `scripts/validate-extension.mjs` | Hard gate. Asserts extension + app source match the audited release contract. |
| `scripts/check-arrow-relay.mjs` | Behavioral check of the arrow-key relay's guards against a stub DOM. Spawned by the validator. |
| `scripts/check-clock-shim.mjs` | Replays each clock-derived game's real day formula through the shimmed `Date`. Spawned by the validator. |
| `scripts/check-ad-coverage.mjs` | Replays real third-party hosts observed on each game against `AD_SERVING_DOMAINS`. Spawned by the validator. |
| `scripts/check-lookup-selection.mjs` | Checks the right-click selection relay only hijacks the context menu for a real selection. Spawned by the validator. |
| `scripts/package-extension.mjs` | Validates, then zips the 4 extension files reproducibly into `public/downloads/`. |
| `public/extension-install.html` | Standalone install/instructions page. |
| `executions/*.json` | Historical task-plan records for past features. Documentation, not code. |
| `worker/`, `db/`, `drizzle/`, `examples/`, `build/sites-vite-plugin.ts`, `.openai/hosting.json` | Leftover vinext/Cloudflare starter scaffolding. Unused by Puzzle Date. |
| `tests/rendered-html.test.mjs` | **Stale starter test.** References `app/_sites-preview/` which does not exist. `npm test` will fail. |

## Two build paths (only one matters)

- **`npm run build:pages`** — `vite build --config vite.pages.config.ts`. Root `pages/`,
  base `/PuzzleDate/`, output `dist-pages/`. **This is the real build**, deployed by
  `.github/workflows/pages.yml` on every push to `main`.
- **`npm run dev` / `build` / `start`** — vinext + Cloudflare Workers (`worker/index.ts`).
  Starter leftovers. Dev server runs on `localhost:3000`, which the extension allowlists.

## App logic (`app/page.tsx`)

### Puzzle catalog

A hardcoded `puzzles: Puzzle[]` array. Each entry:

```ts
type Puzzle = {
  name; publisher; url; color;
  canEmbed?: boolean;      // false = site blocks framing; needs extension
  resetStrategy?: ResetStrategy;
  saturdayOnly?: boolean;  // only shown when new Date().getDay() === 6
  custom?: boolean;        // user-added via the + button
};
```

Built-ins: Connections (NYT), Word 500, FoxiMax, Verticle, Waffle, Unwordle, 4 × 3
(Hank Green), Chain It, Word Salad, Full Circle Friday (`saturdayOnly`), Poople.

`ResetStrategy` is a closed union: `connections-current`, `word500-current`,
`foximax-daily`, `verticle-current`, `four-by-three-current`, `full-circle-current`,
`poople-current`, `custom-clear-all`.

### Rotation & ordering

- On mount, `puzzlesForDay(new Date().getDay())` filters out `saturdayOnly` entries
  unless it is Saturday, then appends saved custom games.
- Order persists in `localStorage["puzzle-date-order"]` as an array of URLs. Restore
  only applies if the saved list matches the available list length **and** starts with
  Connections; otherwise the default order is used.
- Navigation: **⌘/Ctrl + ← / →** (`isNavChord`), Previous/Next buttons, the footer
  pager, and a hover/focus "Jump to a game" menu. Bare arrows deliberately do **not**
  navigate — they belong to games that move a cursor with them. Chords are ignored
  while typing in an input/textarea/select/contenteditable, and when Alt or Shift is
  held.
- **Shuffle is a mode, not an action** (`shuffleMode`, persisted at
  `puzzle-date-shuffle`). Toggling it on shuffles everything after Connections;
  toggling it off restores `puzzlesForDay(...) + customPuzzles`. Either way you stay on
  the game you were playing, the way a music player keeps the current track. It lives
  in the footer next to Previous.
- **Both the page and the frame relay call `preventDefault()` on the chord**, because
  ⌘ + ← / → is the browser's back/forward on macOS. Without it, navigating the
  rotation would also navigate history.

### UI conventions

- **Icons are inline SVG** from the `ICONS` map + `<Icon name=.../>`, all on one 24px
  stroked grid sized by `font-size` (`.icon` is `1em`). No icon font, no dependency.
  Don't reintroduce glyph icons (`↓`, `×`, `→`) — they never matched the text weight.
- **One font family.** `--font` is a system stack, used everywhere. The old CSS mixed
  Arial, Georgia and `var(--font-geist-mono)` — and that last one was **never defined
  in the shipped Vite build** (only `app/layout.tsx` sets it, which the Pages build
  does not load), so those rules silently fell back to bare `monospace`. Numerals use
  `font-variant-numeric: tabular-nums` instead of a separate mono family.
- **Motion** runs off `--fast`/`--slow`/`--ease` tokens, with one shared `transition`
  on interactive elements and two keyframes (`fade-in`, `fade-rise`). Entrance
  animations deliberately have **no `fill-mode`**: if an animation never runs the
  element stays at its normal opacity rather than invisible.
  `prefers-reduced-motion` now blanket-disables durations rather than naming
  three selectors.
- **Footer pager** (`pagerSlots`) is a windowed numeric control: first, last, the
  current page and its neighbours, gaps for the rest, filled outward from the cursor so
  the width stays ~constant. Replaced 11 dashes plus a separate `01 / 11` counter.

### Game zoom

A `<select>` in the topbar scales the frame across `ZOOM_LEVELS` (0.5–2), persisted at
`puzzle-date-zoom`. Applied as inline style: the frame is counter-sized to
`100/zoom %` and then `transform: scale(zoom)` with `transform-origin: top left`, so
the scaled result still fills `.frame-wrap` exactly (verified at 0.5/1/1.5/2). Values
outside `ZOOM_LEVELS` fall back to 1, so a hand-edited localStorage value cannot
produce a broken layout. Purely app-side — no extension, and the game's storage is
untouched.

### Arrow keys while the game frame has focus

A focused cross-origin iframe swallows key events — the parent page cannot observe
them at all, so the `keydown` listener alone cannot cover this. The extension closes
the gap: `forwardArrowKeys` (injected into every child frame alongside the ad CSS)
listens in the bubble phase and `window.parent.postMessage`s
`{source: "puzzle-date-extension", type: "PUZZLE_DATE_ARROW_KEY", key}` for unhandled
arrow presses. `page.tsx` accepts the message only when
`event.source === frameRef.current?.contentWindow`, so a nested ad frame cannot drive
navigation.

The relay deliberately stays out of the game's way — it skips the key when
`event.defaultPrevented` (the game handled it), when it is **not** the ⌘/Ctrl chord,
when Alt or Shift is held, and when the target is an
input/textarea/select/contenteditable. It self-guards against double
registration via a `puzzleDateArrowForwarding` marker on `documentElement`.

**Without the extension this cannot be fixed.** For games embedded without it, the
`onPointerLeave` / `onPointerEnter` focus nudges on the iframe and nav remain the only
fallback.

### Embedding decision

```
canFramePuzzle(p) = p.custom
  ? extensionReady && registeredCustomHosts.has(host(p))
  : p.canEmbed !== false || extensionReady
```

If a puzzle cannot be framed, the app renders an "Opened in a new tab" card and
`goToPuzzle` auto-opens it in a new tab (via a synthesized `<a target="_blank" rel="noopener noreferrer">`).

The iframe is `sandbox`ed (`allow-scripts allow-same-origin allow-forms allow-modals
allow-downloads allow-presentation`), `referrerPolicy="strict-origin-when-cross-origin"`,
`loading="eager"`.

### Timer-safe preload (important invariant)

**Exactly one iframe exists at a time.** An earlier version pre-mounted the next game's
iframe, which started its game timer before the player got there. That is now forbidden.
Instead a `useEffect` injects deduplicated `<link>` hints for the next puzzle's URL —
`preconnect`, `dns-prefetch`, `prefetch as=document` — tagged `data-puzzle-date-hint`
and removed on cleanup.

`validate-extension.mjs` enforces this: exactly one `<iframe` in `page.tsx`, no
`framedPuzzles` / `game-frame preloaded` identifiers.

### Global puzzle date

A `<input type="date">` in the topbar switches the whole rotation to an earlier
day. State lives in `archiveDate`, persisted at `puzzle-date-archive-date`.

**Only 3 of the 11 games can honour it** — the rest have no URL-addressable archive.
This was established by inspecting each game, not assumed:

| Game | Archive URL | Evidence |
|---|---|---|
| Connections | `/games/connections/YYYY-MM-DD` | date route serves a different shell than `/connections`; archive itself is NYT-subscriber gated |
| Word 500 | `/game?mode=archive&date=YYYY-MM-DD` | `game-engine.js` `isValidArchiveDate`: `YYYY-MM-DD`, year ≥ 2022, strictly before today |
| 4 × 3 | `#d=YYYY-MM-DD` | `location.hash` `#d=` branch; keys must exist in `puzzles.json` and be `<= today` |

**Six more have no archive URL but derive the puzzle from the client clock**, so the
extension shifts the clock inside their frame instead (`CLOCK_SHIM_URLS` in the app,
`CLOCK_SHIM_ORIGINS` in the extension — the validator asserts the two lists match):

| Game | Day formula, read from its shipped source |
|---|---|
| Verticle | counts days from `new Date(2022, 0)` |
| FoxiMax | `Math.floor((Date.now() - tzOffset) / 86400000)` |
| Poople | counts days from 2025-08-15 via `Date.now()` |
| Unwordle | `differenceInDays(new Date(), new Date(2022, 0, 19))` |
| Waffle | number↔date from a `2022-02-13T00:00:00.000Z` epoch |
| Word Salad | Rust/WASM calls the JS glue's `new Date()` |

**Two genuinely cannot follow the date.** Full Circle Friday fetches its puzzle from
`fullcirclefriday-e68e27edd409.herokuapp.com` with no date parameter. Chain It reads
from Firestore and could not be confirmed clock-keyed — it is deliberately excluded
rather than shimmed on a guess. The validator hard-fails if either origin (or
nytimes.com) appears in `CLOCK_SHIM_ORIGINS`. Both, plus custom games, stay on today
and show `today only`.

### How the clock shim works

`applyClockShim(isoDate)` replaces `window.Date` with a subclass-ish wrapper offset by
a whole number of days. Explicit arguments (`new Date(0)`, `Date.parse`, `Date.UTC`)
pass through untouched, so saved timestamps are not corrupted; only the zero-argument
`new Date()` and `Date.now()` move.

- Injected from `chrome.webNavigation.onCommitted` with `injectImmediately: true` —
  the earliest hook available, so it lands before the game reads the clock. If it ever
  loses that race the game simply shows today; it fails soft.
- **Never runs in a top-level frame** (`frameId === 0` returns early) and only for
  origins in `CLOCK_SHIM_ORIGINS`, only while that tab has a date set. Ordinary
  browsing of these sites is untouched.
- Guarded by `window.puzzleDateClockShim`, **not** the `documentElement` dataset — the
  script can run before `<html>` exists, and a second wrap would compound the offset
  rather than replace it.

The app tells the extension the date via `PUZZLE_DATE_SET_CLOCK` and waits for
`PUZZLE_DATE_SET_CLOCK_RESULT` before bumping `clockRevision`, which is part of the
iframe `key`. **This ordering matters**: the frame must remount only after the
background knows the date, or the game loads with the real clock. Verified in-browser
as `told → acked → remounted`.

`scripts/check-clock-shim.mjs` replays each game's real formula through the shimmed
`Date` and asserts the index moves by exactly the right number of days. It is run by
`validate-extension`.

`isArchiveDate()` accepts only dates **strictly before today**, because Word 500
rejects today and later. Picking today clears the setting rather than building a
dated URL. A stored date that is no longer in the past is dropped on load.

`puzzleUrl(puzzle, date)` is the single place a dated URL is built; it feeds the iframe
`src`, the iframe `key` (so changing date remounts), the preload hints, and the
new-tab link. `ARCHIVE_URLS` is a standalone map, deliberately **not** a field on
`Puzzle` — the validator parses the `puzzles` array with `/url: "(https:[^"]+)"/g`
and extra URLs inside it would corrupt the domain check. The validator separately
asserts every `ARCHIVE_URLS` origin is an already-configured game domain, so a dated
URL can never point somewhere the reset origin checks would reject.

**Word 500 archive resets use different keys.** Live daily is `<lang><level>hints`;
archive is `arc_<lang><level>_<date>_hints`. `resetCurrentPuzzle` reads the frame's own
`location.search` to pick the right prefix — without this, Start Over on an archived
puzzle silently wipes the live daily one instead.

### Word lookup panel

The middle grid row is `.stage`, a two-column grid: a 250px `<aside className="lookup">`
and the frame. Under 680px it stacks, with the panel capped at `40dvh`.

**Google cannot be embedded** — it sends `X-Frame-Options: DENY`, and the extension's
header stripping is deliberately pinned to the game domains by the validator. So the
panel queries **Wiktionary's REST API**
(`https://en.wiktionary.org/api/rest_v1/page/definition/<word>`) — CORS-open
(`access-control-allow-origin: *`), no key, Wikimedia-hosted. A "Search Google"
link opens a normal tab for anything the dictionary misses.

`api.dictionaryapi.dev` was tried first and rejected: it returned HTTP 522 on six
consecutive probes. Don't switch back.

Wiktionary returns **HTML fragments** in `definition`. `plainText()` flattens them via
`DOMParser`, whose documents are inert — nothing executes and nothing reaches the live
page. **Never** render these through `dangerouslySetInnerHTML`.

`readEnglishSenses()` reads only the `en` key and drops senses with no part of speech
or no definitions. Requests use an `AbortController` held in `lookupRequestRef` so a
fast second search cancels the first; `AbortError` is swallowed rather than shown.
Only the first 3 definitions per part of speech are rendered.

The global arrow-key handler already ignores events whose target matches
`input, textarea, select`, so typing in this box does not flip puzzles.

**Collapsing.** `lookupCollapsed` persists at `puzzle-date-lookup-collapsed`. The
column width comes from `.stage:has(.lookup[data-collapsed])` — 38px on desktop, a
full-width strip on mobile — and the body is hidden with the `hidden` attribute so it
leaves the a11y tree. The toggle carries `aria-expanded` / `aria-controls`.

**Right-click lookup.** A cross-origin frame's selection is invisible to the page, so
`forwardLookupSelection` (injected alongside the ad CSS) listens for `contextmenu` in
the game frame and posts the highlighted text out as `PUZZLE_DATE_LOOKUP_SELECTION`.
It calls `preventDefault()` **only** when there is a usable selection (non-empty,
≤60 chars after whitespace collapsing) — right-clicking with nothing selected must
still give the player the browser's own menu. The page accepts the relay only when
`event.source === frameRef.current?.contentWindow`, re-validates the length, and
reopens a collapsed panel for the result.

`runLookup(word)` is the shared entry point — the form's submit handler and the
relay both call it, so there is one fetch path with one `AbortController`.
`scripts/check-lookup-selection.mjs` covers the frame-side guards.

### Custom games (+ button)

- Paste a full `http(s)` URL. Name is derived from the hostname (strip `www.`, first
  label, title-cased). Max **100** custom games.
- Stored as `{name, url}` in `localStorage["puzzle-date-custom-games"]`; reloaded and
  re-validated on mount (bad protocols/entries silently dropped, malformed JSON purges the key).
- Every custom game gets `canEmbed: false`, `custom: true`, `resetStrategy: "custom-clear-all"`.
- Hostnames are normalized (lowercase, no port, no path) and pushed to the extension via
  a `PUZZLE_DATE_REGISTER_CUSTOM_GAMES` window event. Only hosts confirmed back in
  `PUZZLE_DATE_CUSTOM_GAMES_RESULT` become framable; the result must exactly match the
  pending request. On success `customFrameRevision` bumps, which is part of the iframe
  `key`, forcing a remount now that framing headers are stripped.

### Extension detection & health light

- App dispatches `PUZZLE_DATE_EXTENSION_PING`; content script answers
  `PUZZLE_DATE_EXTENSION_READY` with `{ version }`. An 800 ms timer flips status to
  `missing` if nothing answers (content script runs at `document_start` but the app
  may mount first).
- `EXPECTED_EXTENSION_VERSION` in `page.tsx` must equal `manifest.json`'s `version`.
- Health light: **red** = missing, **yellow** = installed but version mismatch,
  **green** = exact match. State is also announced via a `visually-hidden`
  `aria-live` region.
- Extension guide modal has the download link, install steps, upgrade steps, and the
  destructive-custom-reset warning.

### Start Over

Shown only when the active puzzle has a `resetStrategy` **and** is framable. If the
extension is not ready, clicking it opens the extension guide instead. Otherwise it
dispatches `RESET_ACTIVE_IFRAME` with the strategy.

## Chrome extension

MV3. Permissions: `activeTab`, `scripting`, `webNavigation`, `declarativeNetRequest`,
host `<all_urls>`. Content script matches only `http://localhost:3000/*` and
`https://shikhabansal7.github.io/PuzzleDate/*`, at `document_start`.

### Framing (`rules.json`, static rule id 1)

Removes `x-frame-options`, `content-security-policy`, and
`content-security-policy-report-only` — **only** for `sub_frame` requests, **only** to
the configured built-in game domains, **only** when initiated by
`shikhabansal7.github.io` or `localhost`. Top-level browsing is untouched.

`validate-extension.mjs` parses the `puzzles` array out of `page.tsx` and asserts
`requestDomains` exactly equals the set of configured game hostnames. **Add a game to
`page.tsx` → you must add its domain to `rules.json`.**

### Custom-game framing (dynamic rule id `1000`)

Same three-header removal, `requestDomains` = the registered custom hostnames,
`initiatorDomains` = the Puzzle Date hosts. Rewritten wholesale on every registration.

### Ad blocking (session rules, per tab)

- Enabled only after the Puzzle Date content script sends `ENABLE_PUZZLE_DATE_AD_BLOCK`,
  and every rule is scoped `tabIds: [tabId]`. Removed on `chrome.tabs.onRemoved`.
- **3 rules per tab**, ids allocated as `AD_BLOCK_RULE_ID_BASE + tabId * 3 + i` where
  base is `1001`, so they can never collide with rule `1000`. Tab ids above
  `MAX_AD_BLOCK_TAB_ID` are rejected.
- Rule 1 blocks `AD_SERVING_DOMAINS` (78 audited ad networks). Rules 2–3 block the two
  narrow first-party paths in `AD_BLOCK_URL_FILTERS`
  (`||fourbythree-stats.hankmt.workers.dev/ads`, `||www.nytimes.com/ads/`).
  Resource types: `image, media, script, sub_frame, xmlhttprequest`.
- Cosmetic CSS (`AD_BLOCK_COSMETIC_CSS`) is injected with `origin: "USER"` into **child
  frames only** (`frameId !== 0`), and only when that tab has an active ad rule.
  `insertAdBlockCss` is also the injection point for `handleConsentUi` and
  `forwardArrowKeys`, so the ad rule doubles as the "this is a Puzzle Date tab" gate.

**Hard constraints the validator enforces:** never block whole `workers.dev` or
`nytimes.com` hosts; never add analytics (`googletagmanager.com`,
`google-analytics.com`, `analytics.google.com`, `amplitude.com`), consent gates
(`gatekeeperconsent.com`), login providers (`facebook.net`, `google.com`), players
(`jwplayer.com`), or generic CDNs (`googleapis.com`, `gstatic.com`, `jsdelivr.net`).
The domain list, resource types, URL filters, and cosmetic selectors must match the
audited lists byte-for-byte, with no duplicates.

**The blocklist rots.** Ads reappeared in Sept 2026 with the blocking code completely
unchanged — the games had simply added new header-bidding partners (Ezoic moved to
`ezodn.com`/`ezoic.net`, Waffle added Venatus/`atmtd.com`/`btloader.com`, Word 500
added Raptive's `ay.delivery` plus a dozen exchanges). Before assuming a regression,
`git diff <last-good>..HEAD -- chrome-extension/background.js` and check whether the
ad code changed at all. To re-audit: load each game in a browser and diff its
third-party `performance.getEntriesByType("resource")` hosts against
`AD_SERVING_DOMAINS`, then extend `scripts/check-ad-coverage.mjs` with what you find.
Verticle and FoxiMax currently serve no ads at all.

### Cookie consent (`handleConsentUi`)

Injected into child frames alongside the ad CSS, in `world: "MAIN"`. Searches only
inside **known consent containers** (OneTrust, Funding Choices, Sourcepoint, Quantcast,
generic `cookie-banner`/`cookie-consent` ids and classes) for a control labeled
`reject all`, `decline all`, `necessary only`, `essential only`,
`continue without accepting`, or `do not consent`. Falls back to a known close button,
then to hiding the container via CSS. A `MutationObserver` re-runs for 12 s then
disconnects.

**Never clicks "Accept all"** — the validator fails the build if any acceptance label
(`accept all`, `allow all`, `agree`, `i accept`, `i agree`) appears in `background.js`,
and fails if consent controls are searched with a broad `document.querySelectorAll("button")`.

### Reset strategies (`resetCurrentPuzzle`, injected into the game frame)

Before injecting, `background.js` locates the target child frame by exact URL, then
origin, then "only one child frame", and verifies the frame's origin matches
`RESET_STRATEGY_ORIGINS[strategy]`. For custom resets it verifies the hostname is in the
registered dynamic rule.

| Strategy | What it does |
|---|---|
| `connections-current` | Reads `games-state-connections/ANON`, and for each saved state sets exactly `puzzleComplete:false, puzzleWon:false, mistakes:0, guesses:[], solvedCategories:[]`. Everything else — archive mode, stats, settings — is preserved. Returns `reloadFromParent: true`; the **content script** reassigns `iframe.src` rather than reloading from inside the frame. |
| `word500-current` | Reads `word500lang` + `word500level` (must match `/^[A-Za-z0-9_-]{1,20}$/`), removes `<prefix>hints`, `<prefix>gameover`, `<prefix>guess0..7`, reloads. |
| `foximax-daily` | Removes `daily-letters`, reloads. |
| `verticle-current` | Rewrites `gameState` / `gameOfDayState` with `guesses: []`, `charStatuses: {}`, reloads. |
| `four-by-three-current` | Calls the page's own `globalThis.resetPuzzle()`. No reload. |
| `full-circle-current` | Removes `fullCircleGameState`, reloads. |
| `poople-current` | Removes `guesses`, reloads, then auto-dismisses the "How to play Poople" modal on the next `webNavigation.onCompleted`. |
| `custom-clear-all` | **Destructive.** `localStorage.clear()` on the added game's origin, then reload. Wipes stats/settings/tutorial state. Surfaced as a warning in the UI and README. |

The extension only ever touches `localStorage`. The validator fails on any use of
`sessionStorage`, `indexedDB`, `chrome.cookies`, `document.cookie`, or `caches`.

### Connections Play recovery

After a successful `connections-current` reset, the tab/frame is added to
`pendingConnectionsPlay`. On the next `webNavigation.onCompleted` for the Connections
URL, a script clicks `[data-testid="moment-btn-play"]` — but only if it is an
`HTMLButtonElement` whose trimmed text is exactly `"Play"`. `MutationObserver` waits up
to 10 s. Broad `button` selectors are validator-forbidden.

## Message flow

```
page.tsx  --window CustomEvent-->  content.js  --chrome.runtime.sendMessage-->  background.js
          <--window CustomEvent--              <--sendResponse--
```

Window events: `PUZZLE_DATE_EXTENSION_PING` / `_READY`,
`PUZZLE_DATE_REGISTER_CUSTOM_GAMES` / `_RESULT`,
`RESET_ACTIVE_IFRAME` / `RESET_ACTIVE_IFRAME_RESULT`.

Runtime messages: `ENABLE_PUZZLE_DATE_AD_BLOCK`, `REGISTER_CUSTOM_GAMES`,
`RESET_ACTIVE_IFRAME`. Every one is gated by `isPuzzleDateSender(sender)`:
top frame only, and either `https://shikhabansal7.github.io/PuzzleDate/*` or
`http://localhost:3000`.

## Working in this repo

### Commands

```bash
npm run build:pages         # the real build
npm run validate:extension  # the contract gate — run before committing extension or page.tsx changes
npm run package:extension   # validates, then rebuilds public/downloads/puzzle-date-game-reset.zip
npm run lint
```

`npm test` is broken (stale starter test). Don't rely on it.

### Rules of thumb

- **`validate-extension.mjs` is the spec.** It string-matches specific lines of
  `page.tsx`, `background.js`, `content.js`, `README.md`, and
  `public/extension-install.html`. Refactoring that changes those lines fails the
  build even if the behavior is identical — update the validator deliberately, not
  reflexively.
- **Version bumps touch six places:** `manifest.json`, `EXPECTED_EXTENSION_VERSION`
  in `page.tsx`, the guide modal copy in `page.tsx`, `README.md`,
  `public/extension-install.html`, and the hardcoded version check in
  `validate-extension.mjs`. Then re-run `package:extension` to regenerate the ZIP.
- **Adding a built-in game:** add to `puzzles` in `page.tsx`, add its hostname
  (`www.` stripped) to `rules.json`'s `requestDomains`. If it needs a reset, add the
  strategy to the union in `page.tsx`, to `RESET_STRATEGIES` in `content.js`, and to
  both `RESET_STRATEGY_ORIGINS` and `resetCurrentPuzzle`'s allowlist in `background.js`.
- **Never add a second iframe.** The single-iframe invariant is what keeps game timers
  from starting early.
- **Ad and consent lists are audited, not open-ended.** Adding a domain or selector
  means updating the matching expected list in the validator, which is the review record.
- Storage keys in use: `puzzle-date-order`, `puzzle-date-custom-games`,
  `puzzle-date-archive-date`, `puzzle-date-zoom`, `puzzle-date-lookup-collapsed`,
  `puzzle-date-shuffle`.
