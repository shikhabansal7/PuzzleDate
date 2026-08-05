const RESET_STRATEGY_ORIGINS = {
  "word500-current": "https://word500.com",
  "foximax-daily": "https://foximax.com",
  "verticle-current": "https://verticle.netlify.app",
  "four-by-three-current": "https://www.hankgreen.com",
  "full-circle-current": "https://fullcirclefriday.com",
  "poople-current": "https://poople.io",
};
const CUSTOM_GAMES_RULE_ID = 1000;
const AD_BLOCK_RULE_ID_OFFSET = 1;
const MAX_CUSTOM_HOSTS = 100;
const PUZZLE_DATE_HOSTS = new Set(["shikhabansal7.github.io", "localhost"]);
const CUSTOM_FRAME_HEADERS = [
  "x-frame-options",
  "content-security-policy",
  "content-security-policy-report-only",
];
const AD_SERVING_DOMAINS = [
  "2mdn.net",
  "adnxs.com",
  "adsrvr.org",
  "amazon-adsystem.com",
  "criteo.com",
  "criteo.net",
  "doubleclick.net",
  "googleadservices.com",
  "googlesyndication.com",
  "openx.net",
  "outbrain.com",
  "pubmatic.com",
  "rubiconproject.com",
  "taboola.com",
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
  .pz-section.pz-section-filled.pz-ad-box.pz-desktop-only[data-testid="ad-top"],
  .pz-section.pz-section-filled.pz-ad-box.pz-desktop-only[data-testid="ad-bottom"],
  iframe[src*="doubleclick.net"],
  iframe[src*="googlesyndication.com"] {
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

const adBlockRuleIdForTab = (tabId) => {
  if (!Number.isInteger(tabId) || tabId < 0 || tabId >= 2147483647) return null;
  return tabId + AD_BLOCK_RULE_ID_OFFSET;
};

const getAdBlockRuleForTab = async (tabId) => {
  const ruleId = adBlockRuleIdForTab(tabId);
  if (ruleId === null) return null;
  const rules = await chrome.declarativeNetRequest.getSessionRules();
  return rules.find(
    (rule) => rule.id === ruleId && rule.condition?.tabIds?.includes(tabId),
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
  } catch {
    // Some browser-internal or otherwise restricted child frames cannot be styled.
  }
};

const enableAdBlockForTab = async (tabId) => {
  const ruleId = adBlockRuleIdForTab(tabId);
  if (ruleId === null) throw new Error("Puzzle Date tab ID is invalid.");
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [ruleId],
    addRules: [{
      id: ruleId,
      priority: 1,
      action: { type: "block" },
      condition: {
        requestDomains: AD_SERVING_DOMAINS,
        resourceTypes: AD_BLOCK_RESOURCE_TYPES,
        tabIds: [tabId],
      },
    }],
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

  if (strategy === "word500-current") {
    const language = localStorage.getItem("word500lang");
    const level = localStorage.getItem("word500level");
    const isSanePart = (value) =>
      typeof value === "string" && /^[A-Za-z0-9_-]{1,20}$/.test(value);
    if (!isSanePart(language) || !isSanePart(level)) {
      return { ok: false, error: "Word 500 language or level is invalid." };
    }
    const prefix = `${language}${level}`;
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

chrome.webNavigation.onCompleted.addListener(async ({ tabId, frameId, url }) => {
  if (frameId !== 0) await insertAdBlockCss(tabId, frameId);

  const pendingKey = `${tabId}:${frameId}`;
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
  const ruleId = adBlockRuleIdForTab(tabId);
  if (ruleId === null) return;
  chrome.declarativeNetRequest
    .updateSessionRules({ removeRuleIds: [ruleId] })
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
