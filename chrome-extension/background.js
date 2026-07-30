const clearStorageAndReload = (keys) => {
  for (const key of keys) {
    localStorage.removeItem(key);
  }
  window.location.reload();
};

const pendingPoopleDismissals = new Set();

chrome.webNavigation.onCompleted.addListener(async ({ tabId, frameId, url }) => {
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== "RESET_ACTIVE_IFRAME" || !sender.tab?.id) {
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
      if (message.keys.includes("guesses")) {
        pendingPoopleDismissals.add(`${tabId}:${target.frameId}`);
      }

      await chrome.scripting.executeScript({
        target: { tabId, frameIds: [target.frameId] },
        world: "MAIN",
        func: clearStorageAndReload,
        args: [Array.isArray(message.keys) ? message.keys : []],
      });
      sendResponse({ ok: true });
    } catch (error) {
      sendResponse({ ok: false, error: String(error) });
    }
  });

  return true;
});
