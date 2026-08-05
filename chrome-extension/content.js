const findActiveIframe = () => {
  const frames = [...document.querySelectorAll("iframe")];
  return frames.find((frame) => {
    const rect = frame.getBoundingClientRect();
    const style = window.getComputedStyle(frame);
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      style.display !== "none" &&
      style.visibility !== "hidden"
    );
  });
};

const advertiseReadiness = () => {
  window.dispatchEvent(new CustomEvent("PUZZLE_DATE_EXTENSION_READY"));
};

const RESET_STRATEGIES = new Set([
  "word500-current",
  "foximax-daily",
  "verticle-current",
  "four-by-three-current",
  "full-circle-current",
  "poople-current",
]);
const MAX_CUSTOM_HOSTS = 100;
const normalizeHostnames = (value) => {
  if (!Array.isArray(value) || value.length > MAX_CUSTOM_HOSTS) return null;
  const hostnames = [];
  for (const valuePart of value) {
    if (typeof valuePart !== "string" || valuePart !== valuePart.toLowerCase()) {
      return null;
    }
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

window.addEventListener("PUZZLE_DATE_EXTENSION_PING", advertiseReadiness);
advertiseReadiness();
chrome.runtime.sendMessage({ type: "ENABLE_PUZZLE_DATE_AD_BLOCK" });

window.addEventListener("PUZZLE_DATE_REGISTER_CUSTOM_GAMES", (event) => {
  const hostnames = normalizeHostnames(event.detail?.hostnames);
  if (!hostnames) {
    window.dispatchEvent(new CustomEvent("PUZZLE_DATE_CUSTOM_GAMES_RESULT", {
      detail: { ok: false, error: "Custom game hostnames are invalid." },
    }));
    return;
  }
  chrome.runtime.sendMessage(
    { type: "REGISTER_CUSTOM_GAMES", hostnames },
    (response) => {
      const error = chrome.runtime.lastError?.message;
      window.dispatchEvent(new CustomEvent("PUZZLE_DATE_CUSTOM_GAMES_RESULT", {
        detail: error
          ? { ok: false, error }
          : response ?? { ok: false, error: "Registration did not respond." },
      }));
    },
  );
});

window.addEventListener("RESET_ACTIVE_IFRAME", (event) => {
  const strategy = event.detail?.strategy;
  const customReset = strategy === "custom-clear-all";
  if (!RESET_STRATEGIES.has(strategy) && !customReset) {
    window.dispatchEvent(
      new CustomEvent("RESET_ACTIVE_IFRAME_RESULT", {
        detail: { ok: false, error: "Unsupported reset strategy." },
      }),
    );
    return;
  }

  const iframe = findActiveIframe();
  if (!iframe?.src) {
    window.dispatchEvent(
      new CustomEvent("RESET_ACTIVE_IFRAME_RESULT", {
        detail: { ok: false, error: "Active iframe was not found." },
      }),
    );
    return;
  }

  let hostname;
  if (customReset) {
    if (iframe.dataset.customGame !== "true") {
      window.dispatchEvent(new CustomEvent("RESET_ACTIVE_IFRAME_RESULT", {
        detail: { ok: false, error: "Active iframe is not a custom game." },
      }));
      return;
    }
    try {
      const parsed = new URL(iframe.src);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
      hostname = parsed.hostname.toLowerCase();
    } catch {
      window.dispatchEvent(new CustomEvent("RESET_ACTIVE_IFRAME_RESULT", {
        detail: { ok: false, error: "Custom game URL is invalid." },
      }));
      return;
    }
  }

  chrome.runtime.sendMessage(
    { type: "RESET_ACTIVE_IFRAME", frameUrl: iframe.src, strategy, hostname },
    (response) => {
      const error = chrome.runtime.lastError?.message;
      window.dispatchEvent(
        new CustomEvent("RESET_ACTIVE_IFRAME_RESULT", {
          detail: error
            ? { ok: false, error }
            : response ?? { ok: false, error: "Reset did not respond." },
        }),
      );
    },
  );
});
