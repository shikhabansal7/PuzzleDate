const RESET_STRATEGY_ORIGINS = {
  "connections-current": "https://www.nytimes.com",
  "word500-current": "https://word500.com",
  "foximax-daily": "https://foximax.com",
  "verticle-current": "https://verticle.netlify.app",
  "four-by-three-current": "https://www.hankgreen.com",
  "full-circle-current": "https://fullcirclefriday.com",
  "poople-current": "https://poople.io",
};
const CUSTOM_GAMES_RULE_ID = 1000;
const AD_BLOCK_RULES_PER_TAB = 3;
const AD_BLOCK_RULE_ID_BASE = CUSTOM_GAMES_RULE_ID + 1;
const MAX_AD_BLOCK_TAB_ID = Math.floor(
  (2147483647 - AD_BLOCK_RULE_ID_BASE - (AD_BLOCK_RULES_PER_TAB - 1)) /
    AD_BLOCK_RULES_PER_TAB,
);
const MAX_CUSTOM_HOSTS = 100;
const PUZZLE_DATE_HOSTS = new Set(["shikhabansal7.github.io", "localhost"]);
const CUSTOM_FRAME_HEADERS = [
  "x-frame-options",
  "content-security-policy",
  "content-security-policy-report-only",
];
// Audited 2026-09-11 by loading every embedded game and listing the
// third-party hosts it actually contacts. The games have added whole
// header-bidding stacks since this list was first written, which is why ads
// came back. Analytics (Google Analytics/Tag Manager, Amplitude), consent
// gates, login providers, fonts, and generic CDNs are deliberately absent.
const AD_SERVING_DOMAINS = [
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
const AD_BLOCK_URL_FILTERS = [
  "||fourbythree-stats.hankmt.workers.dev/ads",
  "||www.nytimes.com/ads/",
];
const AD_BLOCK_RESOURCE_TYPES = [
  "image",
  "media",
  "script",
  "sub_frame",
  "xmlhttprequest",
];
const AD_BLOCK_COSMETIC_CSS = `
  .adsbygoogle,
  [id^="google_ads_"],
  [data-ad-slot],
  [data-ad-client],
  .ad-container,
  .ad-wrapper,
  .advertisement,
  .advertising,
  [class*="adthrive" i],
  [id*="adthrive" i],
  [data-adthrive],
  [class*="raptive" i],
  [id*="raptive" i],
  .adbox,
  .game-adbox,
  .top-banner-container,
  .bottom-banner-container,
  [data-type="desktop-adhesion"],
  [id^="ezoic-pub-ad-placeholder-"],
  .Advertisement,
  [data-fuse],
  #leaderboard-ad,
  #lhs-ad,
  #rhs-ad,
  .promo-banner,
  .promo-side,
  .pz-section.pz-section-filled.pz-ad-box.pz-desktop-only[data-testid="ad-top"],
  .pz-section.pz-section-filled.pz-ad-box.pz-desktop-only[data-testid="ad-bottom"],
  iframe[src*="doubleclick.net"],
  iframe[src*="googlesyndication.com"],
  iframe[src*="videoplayerhub.com"] {
    display: none !important;
    visibility: hidden !important;
  }

  #onetrust-banner-sdk,
  #onetrust-consent-sdk,
  .fc-consent-root,
  [class*="fc-consent-root"],
  [id^="sp_message_container_"],
  .qc-cmp2-container,
  #qc-cmp2-container,
  [class~="cookie-consent"],
  [class~="cookie-consent-banner"],
  [class~="cookie-banner"],
  [id="cookie-consent"],
  [id="cookie-consent-banner"],
  [id="cookie-banner"] {
    display: none !important;
    visibility: hidden !important;
    pointer-events: none !important;
  }
`;

const handleConsentUi = () => {
  const containerSelectors = [
    "#onetrust-banner-sdk",
    "#onetrust-consent-sdk",
    ".fc-consent-root",
    '[class*="fc-consent-root"]',
    '[id^="sp_message_container_"]',
    ".qc-cmp2-container",
    "#qc-cmp2-container",
    '[class~="cookie-consent"]',
    '[class~="cookie-consent-banner"]',
    '[class~="cookie-banner"]',
    '[id="cookie-consent"]',
    '[id="cookie-consent-banner"]',
    '[id="cookie-banner"]',
  ];
  const privacyLabels = new Set([
    "reject all",
    "decline all",
    "necessary only",
    "essential only",
    "continue without accepting",
    "do not consent",
  ]);
  const closeSelectors = [
    ".onetrust-close-btn-handler",
    ".qc-cmp2-close-icon",
    'button[aria-label="Close"]',
    'button[aria-label="close"]',
    '[role="button"][aria-label="Close"]',
    '[role="button"][aria-label="close"]',
    'button[title="Close"]',
    'button[title="close"]',
  ];
  const normalizeLabel = (element) =>
    (element.getAttribute("aria-label") || element.textContent || "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();

  const cleanKnownContainers = () => {
    const containers = document.querySelectorAll(containerSelectors.join(","));
    for (const container of containers) {
      const controls = container.querySelectorAll(
        'button, [role="button"], input[type="button"], input[type="submit"], a',
      );
      const privacyControl = [...controls].find((control) =>
        privacyLabels.has(normalizeLabel(control)),
      );
      if (privacyControl) {
        privacyControl.click();
        continue;
      }
      container.querySelector(closeSelectors.join(","))?.click();
    }
  };

  cleanKnownContainers();
  const marker = "puzzleDateConsentCleanupActive";
  if (document.documentElement.dataset[marker] === "true") return;
  document.documentElement.dataset[marker] = "true";
  const observer = new MutationObserver(cleanKnownContainers);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  globalThis.setTimeout(() => {
    observer.disconnect();
    delete document.documentElement.dataset[marker];
    cleanKnownContainers();
  }, 12000);
};

// Games that pick their puzzle purely from the client clock. Each was read
// from source: Verticle counts days from 2022-01-01, FoxiMax divides Date.now()
// by 86400000, Poople counts from 2025-08-15, Unwordle diffs against
// 2022-01-19, Waffle maps its number from a 2022-02-13 epoch, and Word Salad's
// WASM asks the JS glue for `new Date()`. Shifting the clock inside the frame
// is the only way to reach their archives, since none expose a date in the URL.
// Deliberately excluded: Full Circle Friday (fetches its puzzle from a server
// with no date parameter) and Chain It (Firestore query we could not confirm is
// clock-keyed).
const CLOCK_SHIM_ORIGINS = new Set([
  "https://verticle.netlify.app",
  "https://foximax.com",
  "https://poople.io",
  "https://unwordle.org",
  "https://wafflegame.net",
  "https://wordsalad.online",
]);

const puzzleDateByTab = new Map();

const isPastIsoDate = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    return false;
  }
  const now = new Date();
  return parsed.getTime() < Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
};

// Runs in the game frame before its own scripts, so date-derived daily games
// compute the archived puzzle instead of today's.
const applyClockShim = (isoDate) => {
  const marker = "puzzleDateClockShim";
  // Guard on window, not documentElement: this can run before <html> exists,
  // and a second wrap would compound the offset instead of replacing it.
  if (window[marker]) return;
  window[marker] = isoDate;
  if (document.documentElement) document.documentElement.dataset[marker] = isoDate;

  const RealDate = Date;
  const realNow = RealDate.now;
  const target = new RealDate(`${isoDate}T00:00:00`);
  if (Number.isNaN(target.getTime())) return;

  // Shift whole days only, so the game keeps a plausible time of day.
  const real = new RealDate();
  const startOfToday = new RealDate(
    real.getFullYear(),
    real.getMonth(),
    real.getDate(),
  );
  const offset = target.getTime() - startOfToday.getTime();
  const shiftedNow = () => realNow.call(RealDate) + offset;

  function ShimDate(...args) {
    if (!new.target) return new RealDate(shiftedNow()).toString();
    return args.length === 0 ? new RealDate(shiftedNow()) : new RealDate(...args);
  }
  ShimDate.prototype = RealDate.prototype;
  ShimDate.parse = RealDate.parse;
  ShimDate.UTC = RealDate.UTC;
  ShimDate.now = shiftedNow;
  Object.setPrototypeOf(ShimDate, RealDate);

  window.Date = ShimDate;
};

const forwardArrowKeys = () => {
  const marker = "puzzleDateArrowForwarding";
  if (document.documentElement.dataset[marker] === "true") return;
  document.documentElement.dataset[marker] = "true";

  window.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    // The game handled the key itself, so Puzzle Date must not also navigate.
    if (event.defaultPrevented) return;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;

    const target = event.target;
    if (
      target instanceof HTMLElement &&
      (target.isContentEditable ||
        target.matches("input, textarea, select"))
    ) {
      return;
    }

    window.parent.postMessage(
      {
        source: "puzzle-date-extension",
        type: "PUZZLE_DATE_ARROW_KEY",
        key: event.key,
      },
      "*",
    );
  });
};

const adBlockRuleIdsForTab = (tabId) => {
  if (!Number.isInteger(tabId) || tabId < 0 || tabId > MAX_AD_BLOCK_TAB_ID) return null;
  const firstRuleId = AD_BLOCK_RULE_ID_BASE + tabId * AD_BLOCK_RULES_PER_TAB;
  return Array.from(
    { length: AD_BLOCK_RULES_PER_TAB },
    (_, index) => firstRuleId + index,
  );
};

const getAdBlockRuleForTab = async (tabId) => {
  const ruleIds = adBlockRuleIdsForTab(tabId);
  if (ruleIds === null) return null;
  const rules = await chrome.declarativeNetRequest.getSessionRules();
  return rules.find(
    (rule) => rule.id === ruleIds[0] && rule.condition?.tabIds?.includes(tabId),
  ) ?? null;
};

const insertAdBlockCss = async (tabId, frameId) => {
  if (frameId === 0 || !(await getAdBlockRuleForTab(tabId))) return;
  try {
    await chrome.scripting.insertCSS({
      target: { tabId, frameIds: [frameId] },
      css: AD_BLOCK_COSMETIC_CSS,
      origin: "USER",
    });
    await chrome.scripting.executeScript({
      target: { tabId, frameIds: [frameId] },
      world: "MAIN",
      func: handleConsentUi,
    });
    await chrome.scripting.executeScript({
      target: { tabId, frameIds: [frameId] },
      world: "MAIN",
      func: forwardArrowKeys,
    });
  } catch {
    // Some browser-internal or otherwise restricted child frames cannot be styled.
  }
};

const enableAdBlockForTab = async (tabId) => {
  const ruleIds = adBlockRuleIdsForTab(tabId);
  if (ruleIds === null) throw new Error("Puzzle Date tab ID is invalid.");
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: ruleIds,
    addRules: [{
      id: ruleIds[0],
      priority: 1,
      action: { type: "block" },
      condition: {
        requestDomains: AD_SERVING_DOMAINS,
        resourceTypes: AD_BLOCK_RESOURCE_TYPES,
        tabIds: [tabId],
      },
    }, ...AD_BLOCK_URL_FILTERS.map((urlFilter, index) => ({
      id: ruleIds[index + 1],
      priority: 1,
      action: { type: "block" },
      condition: {
        urlFilter,
        resourceTypes: AD_BLOCK_RESOURCE_TYPES,
        tabIds: [tabId],
      },
    }))],
  });

  const frames = await chrome.webNavigation.getAllFrames({ tabId });
  await Promise.all(
    (frames ?? [])
      .filter((frame) => frame.frameId !== 0)
      .map((frame) => insertAdBlockCss(tabId, frame.frameId)),
  );
  return { ok: true };
};

const normalizeHostnames = (value) => {
  if (!Array.isArray(value) || value.length > MAX_CUSTOM_HOSTS) return null;
  const hostnames = [];
  for (const valuePart of value) {
    if (typeof valuePart !== "string" || valuePart !== valuePart.toLowerCase()) return null;
    try {
      const parsed = new URL(`https://${valuePart}`);
      if (parsed.hostname !== valuePart || parsed.host !== valuePart || parsed.pathname !== "/") {
        return null;
      }
    } catch {
      return null;
    }
    hostnames.push(valuePart);
  }
  return [...new Set(hostnames)].sort();
};

const isPuzzleDateSender = (sender) => {
  try {
    if (sender.frameId !== 0) return false;
    const url = new URL(sender.url ?? sender.tab?.url ?? "");
    return (
      (url.protocol === "https:" &&
        url.hostname === "shikhabansal7.github.io" &&
        url.pathname.startsWith("/PuzzleDate/")) ||
      (url.protocol === "http:" &&
        url.hostname === "localhost" &&
        url.port === "3000")
    );
  } catch {
    return false;
  }
};

const registerCustomGames = async (hostnames) => {
  const addRules = hostnames.length
    ? [{
        id: CUSTOM_GAMES_RULE_ID,
        priority: 1,
        action: {
          type: "modifyHeaders",
          responseHeaders: CUSTOM_FRAME_HEADERS.map((header) => ({
            header,
            operation: "remove",
          })),
        },
        condition: {
          requestDomains: hostnames,
          initiatorDomains: [...PUZZLE_DATE_HOSTS],
          resourceTypes: ["sub_frame"],
        },
      }]
    : [];
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [CUSTOM_GAMES_RULE_ID],
    addRules,
  });
  return { ok: true, hostnames };
};

const clearCustomGame = () => {
  localStorage.clear();
  window.location.reload();
  return { ok: true };
};

const resetCurrentPuzzle = (strategy) => {
  const allowedStrategies = new Set([
    "connections-current",
    "word500-current",
    "foximax-daily",
    "verticle-current",
    "four-by-three-current",
    "full-circle-current",
    "poople-current",
  ]);
  if (!allowedStrategies.has(strategy)) {
    return { ok: false, error: "Unsupported reset strategy." };
  }

  if (strategy === "connections-current") {
    const key = "games-state-connections/ANON";
    const storedValue = localStorage.getItem(key);
    if (storedValue === null) {
      return { ok: false, error: "Connections game state is missing." };
    }
    let state;
    try {
      state = JSON.parse(storedValue);
    } catch {
      return { ok: false, error: "Connections game state is malformed." };
    }
    if (!state || typeof state !== "object" || Array.isArray(state) || !Array.isArray(state.states)) {
      return { ok: false, error: "Connections game state is malformed." };
    }
    const resetStates = [];
    for (const savedState of state.states) {
      if (
        !savedState ||
        typeof savedState !== "object" ||
        Array.isArray(savedState) ||
        !savedState.data ||
        typeof savedState.data !== "object" ||
        Array.isArray(savedState.data)
      ) {
        return { ok: false, error: "Connections game state is malformed." };
      }
      resetStates.push({
        ...savedState,
        data: {
          ...savedState.data,
          puzzleComplete: false,
          puzzleWon: false,
          mistakes: 0,
          guesses: [],
          solvedCategories: [],
        },
      });
    }
    localStorage.setItem(key, JSON.stringify({ ...state, states: resetStates }));
    return { ok: true, reloadFromParent: true };
  } else if (strategy === "word500-current") {
    const language = localStorage.getItem("word500lang");
    const level = localStorage.getItem("word500level");
    const isSanePart = (value) =>
      typeof value === "string" && /^[A-Za-z0-9_-]{1,20}$/.test(value);
    if (!isSanePart(language) || !isSanePart(level)) {
      return { ok: false, error: "Word 500 language or level is invalid." };
    }
    // Archive puzzles keep their own arc_<lang><level>_<date>_* keys, so a
    // reset there must not clear the live daily puzzle instead.
    const params = new URLSearchParams(window.location.search);
    const archiveDate = params.get("date");
    const prefix =
      params.get("mode") === "archive" &&
      typeof archiveDate === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(archiveDate)
        ? `arc_${language}${level}_${archiveDate}_`
        : `${language}${level}`;
    localStorage.removeItem(`${prefix}hints`);
    localStorage.removeItem(`${prefix}gameover`);
    for (let index = 0; index < 8; index += 1) {
      localStorage.removeItem(`${prefix}guess${index}`);
    }
  } else if (strategy === "foximax-daily") {
    localStorage.removeItem("daily-letters");
  } else if (strategy === "verticle-current") {
    const updates = [];
    for (const key of ["gameState", "gameOfDayState"]) {
      const storedValue = localStorage.getItem(key);
      if (storedValue === null) continue;
      try {
        const state = JSON.parse(storedValue);
        if (!state || typeof state !== "object" || Array.isArray(state)) {
          return { ok: false, error: `Verticle ${key} is malformed.` };
        }
        updates.push([key, JSON.stringify({
          ...state,
          guesses: [],
          charStatuses: {},
        })]);
      } catch {
        return { ok: false, error: `Verticle ${key} is malformed.` };
      }
    }
    for (const [key, value] of updates) localStorage.setItem(key, value);
  } else if (strategy === "four-by-three-current") {
    if (typeof globalThis.resetPuzzle !== "function") {
      return { ok: false, error: "4 × 3 reset is unavailable." };
    }
    globalThis.resetPuzzle();
    return { ok: true };
  } else if (strategy === "full-circle-current") {
    localStorage.removeItem("fullCircleGameState");
  } else if (strategy === "poople-current") {
    localStorage.removeItem("guesses");
  }

  window.location.reload();
  return { ok: true };
};

const pendingPoopleDismissals = new Set();
const pendingConnectionsPlay = new Set();

// onCommitted + injectImmediately is the earliest hook available, so the shim
// lands before the game reads the clock.
chrome.webNavigation.onCommitted.addListener(async ({ tabId, frameId, url }) => {
  if (frameId === 0) return;
  const isoDate = puzzleDateByTab.get(tabId);
  if (!isoDate) return;

  let origin;
  try {
    origin = new URL(url).origin;
  } catch {
    return;
  }
  if (!CLOCK_SHIM_ORIGINS.has(origin)) return;

  try {
    await chrome.scripting.executeScript({
      target: { tabId, frameIds: [frameId] },
      world: "MAIN",
      injectImmediately: true,
      func: applyClockShim,
      args: [isoDate],
    });
  } catch {
    // The frame can go away mid-navigation; the game just shows today.
  }
});

chrome.webNavigation.onCompleted.addListener(async ({ tabId, frameId, url }) => {
  if (frameId !== 0) await insertAdBlockCss(tabId, frameId);

  const pendingKey = `${tabId}:${frameId}`;
  if (
    pendingConnectionsPlay.has(pendingKey) &&
    (
      url === "https://www.nytimes.com/games/connections" ||
      url.startsWith("https://www.nytimes.com/games/connections?") ||
      url.startsWith("https://www.nytimes.com/games/connections#")
    )
  ) {
    pendingConnectionsPlay.delete(pendingKey);
    await chrome.scripting.executeScript({
      target: { tabId, frameIds: [frameId] },
      world: "MAIN",
      func: () => {
        const marker = "puzzleDateConnectionsPlayPending";
        if (!document.documentElement || document.documentElement.dataset[marker]) return;
        document.documentElement.dataset[marker] = "true";

        let observer;
        let timeoutId;
        const cleanup = () => {
          observer?.disconnect();
          clearTimeout(timeoutId);
          delete document.documentElement?.dataset[marker];
        };
        const clickExactPlay = () => {
          const button = document.querySelector('[data-testid="moment-btn-play"]');
          if (
            button instanceof HTMLButtonElement &&
            button.textContent?.trim().replace(/\s+/g, " ") === "Play"
          ) {
            button.click();
            cleanup();
            return true;
          }
          return false;
        };

        if (clickExactPlay()) return;
        observer = new MutationObserver(clickExactPlay);
        observer.observe(document.documentElement, { childList: true, subtree: true });
        timeoutId = setTimeout(cleanup, 10000);
      },
    });
  }

  if (
    !pendingPoopleDismissals.has(pendingKey) ||
    !url.startsWith("https://poople.io/")
  ) {
    return;
  }

  pendingPoopleDismissals.delete(pendingKey);
  await chrome.scripting.executeScript({
    target: { tabId, frameIds: [frameId] },
    world: "MAIN",
    func: () => {
      const title = [
        ...document.querySelectorAll(".Modal:not(.hide) .ModalTitle"),
      ].find(
        (element) => element.textContent?.trim() === "How to play Poople",
      );
      title
        ?.closest(".Modal")
        ?.querySelector(".ModalCloseButton")
        ?.click();
    },
  });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  puzzleDateByTab.delete(tabId);
  const ruleIds = adBlockRuleIdsForTab(tabId);
  if (ruleIds === null) return;
  chrome.declarativeNetRequest
    .updateSessionRules({ removeRuleIds: ruleIds })
    .catch(() => {});
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.tab?.id === undefined || !isPuzzleDateSender(sender)) {
    return;
  }

  if (message?.type === "ENABLE_PUZZLE_DATE_AD_BLOCK") {
    enableAdBlockForTab(sender.tab.id)
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }

  if (message?.type === "SET_PUZZLE_DATE") {
    const isoDate = message.date;
    if (isoDate === "") {
      puzzleDateByTab.delete(sender.tab.id);
      sendResponse({ ok: true, date: "" });
      return;
    }
    if (!isPastIsoDate(isoDate)) {
      sendResponse({ ok: false, error: "Puzzle date must be an earlier day." });
      return;
    }
    puzzleDateByTab.set(sender.tab.id, isoDate);
    sendResponse({ ok: true, date: isoDate });
    return;
  }

  if (message?.type === "REGISTER_CUSTOM_GAMES") {
    const hostnames = normalizeHostnames(message.hostnames);
    if (!hostnames) {
      sendResponse({ ok: false, error: "Custom game hostnames are invalid." });
      return;
    }
    registerCustomGames(hostnames)
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: String(error) }));
    return true;
  }

  if (message?.type !== "RESET_ACTIVE_IFRAME") return;

  const expectedOrigin = RESET_STRATEGY_ORIGINS[message.strategy];
  const customReset = message.strategy === "custom-clear-all";
  if (!expectedOrigin && !customReset) {
    sendResponse({ ok: false, error: "Unsupported reset strategy." });
    return;
  }

  const tabId = sender.tab.id;

  chrome.webNavigation.getAllFrames({ tabId }, async (frames) => {
    const childFrames = frames?.filter((frame) => frame.frameId !== 0) ?? [];
    let requestedOrigin = "";

    try {
      requestedOrigin = new URL(message.frameUrl).origin;
    } catch {
      // Keep the exact URL and single-frame fallbacks below.
    }

    const target =
      childFrames.find((frame) => frame.url === message.frameUrl) ??
      childFrames.find((frame) => {
        try {
          return requestedOrigin && new URL(frame.url).origin === requestedOrigin;
        } catch {
          return false;
        }
      }) ??
      (childFrames.length === 1 ? childFrames[0] : undefined);

    if (!target) {
      sendResponse({ ok: false, error: "Active iframe was not found." });
      return;
    }

    try {
      const targetUrl = new URL(target.url);
      if (customReset) {
        const hostname = normalizeHostnames([message.hostname])?.[0];
        if (!hostname || targetUrl.hostname.toLowerCase() !== hostname) {
          sendResponse({ ok: false, error: "Custom reset does not match the active game." });
          return;
        }
        const dynamicRules = await chrome.declarativeNetRequest.getDynamicRules();
        const registeredDomains = dynamicRules.find(
          (rule) => rule.id === CUSTOM_GAMES_RULE_ID,
        )?.condition?.requestDomains;
        if (!Array.isArray(registeredDomains) || !registeredDomains.includes(hostname)) {
          sendResponse({ ok: false, error: "Custom game hostname is not registered." });
          return;
        }
      } else if (targetUrl.origin !== expectedOrigin) {
        sendResponse({ ok: false, error: "Reset strategy does not match the active game." });
        return;
      }
    } catch {
      sendResponse({ ok: false, error: "Active iframe URL is invalid." });
      return;
    }

    try {
      if (message.strategy === "poople-current") {
        pendingPoopleDismissals.add(`${tabId}:${target.frameId}`);
      }

      const results = await chrome.scripting.executeScript({
        target: { tabId, frameIds: [target.frameId] },
        world: "MAIN",
        func: customReset ? clearCustomGame : resetCurrentPuzzle,
        args: customReset ? [] : [message.strategy],
      });
      const result = results[0]?.result;
      if (result?.ok && message.strategy === "connections-current") {
        pendingConnectionsPlay.add(`${tabId}:${target.frameId}`);
      }
      if (!result?.ok && message.strategy === "poople-current") {
        pendingPoopleDismissals.delete(`${tabId}:${target.frameId}`);
      }
      sendResponse(result ?? { ok: false, error: "Reset did not return a result." });
    } catch (error) {
      if (message.strategy === "poople-current") {
        pendingPoopleDismissals.delete(`${tabId}:${target.frameId}`);
      }
      sendResponse({ ok: false, error: String(error) });
    }
  });

  return true;
});
