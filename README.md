# vinext-starter

A clean full-stack starter running on
[vinext](https://github.com/cloudflare/vinext), with optional Cloudflare D1 and
Drizzle support.

## Prerequisites

- Node.js `>=22.13.0`

## Quick Start

```bash
npm install
npm run dev
npm run build
```

This starter does not use `wrangler.jsonc`.

## Included Shape

- edit site code under `app/`
- `.openai/hosting.json` declares optional Sites D1 and R2 bindings
- `vite.config.ts` simulates declared bindings for local development
- `db/schema.ts` starts intentionally empty
- `examples/d1/` contains an optional D1 example surface
- `drizzle.config.ts` supports local migration generation when needed

## Workspace Auth Headers

OpenAI workspace sites can read the current user's email from
`oai-authenticated-user-email`.

SIWC-authenticated workspace sites may also receive
`oai-authenticated-user-full-name` when the user's SIWC profile has a non-empty
`name` claim. The full-name value is percent-encoded UTF-8 and is accompanied by
`oai-authenticated-user-full-name-encoding: percent-encoded-utf-8`.

Treat the full name as optional and fall back to email when it is absent:

```tsx
import { headers } from "next/headers";

export default async function Home() {
  const requestHeaders = await headers();
  const email = requestHeaders.get("oai-authenticated-user-email");
  const encodedFullName = requestHeaders.get("oai-authenticated-user-full-name");
  const fullName =
    encodedFullName &&
    requestHeaders.get("oai-authenticated-user-full-name-encoding") ===
      "percent-encoded-utf-8"
      ? decodeURIComponent(encodedFullName)
      : null;

  const displayName = fullName ?? email;
  // ...
}
```

## Optional Dispatch-Owned ChatGPT Sign-In

Import the ready-to-use helpers from `app/chatgpt-auth.ts` when the site needs
optional or required ChatGPT sign-in:

- Use `getChatGPTUser()` for optional signed-in UI.
- Use `requireChatGPTUser(returnTo)` for server-rendered pages that should send
  anonymous visitors through Sign in with ChatGPT.
- Use `chatGPTSignInPath(returnTo)` and `chatGPTSignOutPath(returnTo)` for
  browser links or actions.
- Pass a same-origin relative `returnTo` path for the destination after sign-in
  or sign-out. The helper validates and safely encodes it.
- Mark protected pages with `export const dynamic = "force-dynamic"` because
  they depend on per-request identity headers.

Dispatch owns `/signin-with-chatgpt`, `/signout-with-chatgpt`, `/callback`, the
OAuth cookies, and identity header injection. Do not implement app routes for
those reserved paths. Routes that do not import and call the helper remain
anonymous-compatible.

SIWC establishes identity only; it does not prove workspace membership. Use the
Sites hosting platform's access policy controls for workspace-wide restrictions,
or enforce explicit server-side membership or allowlist checks.

Use SIWC for account pages, user-specific dashboards, saved records, and write
actions tied to the current ChatGPT user. Leave public content anonymous.

## Useful Commands

- `npm run dev`: start local development
- `npm run build`: verify the vinext build output
- `npm test`: build the starter and verify its rendered loading skeleton
- `npm run db:generate`: generate Drizzle migrations after schema changes

## Share the Chrome extension

Puzzle Date's companion Chrome extension embeds the complete built-in game
rotation. Version 1.0.7 also registers the hostname of each game added through
the plus button so that game can embed inside Puzzle Date.

Version 1.0.7 blocks common ads and trackers only while games are embedded
inside Puzzle Date. It does not block ads during ordinary browsing and does not
accept or dismiss cookie consent messages.

For built-in games, **Start Over** is offered only where Puzzle Date has a
narrow reset for the current puzzle: Word 500, FoxiMax, Verticle, 4 × 3, Full
Circle Friday, and Poople. These resets target the game's current-puzzle state
instead of clearing all storage for the site.

For a game added through the plus button, **Start Over deletes all
`localStorage` for that added game's origin** and reloads it. This is
intentionally destructive and may erase that site's statistics, tutorial
completion, settings, and other saved progress. It does not clear cookies,
session storage, IndexedDB, or caches.

Validate and package a fresh copy from the checked-in `chrome-extension/`
source with:

```bash
npm run validate:extension
npm run package:extension
```

This writes `public/downloads/puzzle-date-game-reset.zip`. To install it:

1. Download the ZIP and unzip it.
2. Open `chrome://extensions` in Google Chrome.
3. Turn on **Developer mode** in the top-right corner.
4. Click **Load unpacked** and select the unzipped folder—the folder that
   directly contains `manifest.json`.
5. Refresh Puzzle Date if it was already open.

Chrome does not automatically replace a manually loaded extension. To upgrade
an existing installation to version 1.0.7:

1. Download the new ZIP and unzip it to a new folder.
2. Open `chrome://extensions`.
3. Remove the old **Puzzle Date Game Reset** card.
4. Click **Load unpacked** and select the new folder that directly contains
   `manifest.json`.
5. Refresh Puzzle Date and confirm the extension card shows version 1.0.7.

The framing rules are limited to iframe requests initiated by Puzzle Date (or
localhost during development), to the configured built-in domains and custom
hostnames registered from the plus button, and to removing the three headers
that otherwise prevent embedding. Normal top-level visits are not modified.

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [Drizzle D1 Guide](https://orm.drizzle.team/docs/get-started/d1-new)
