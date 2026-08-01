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

window.addEventListener("PUZZLE_DATE_EXTENSION_PING", advertiseReadiness);
advertiseReadiness();

window.addEventListener("RESET_ACTIVE_IFRAME", (event) => {
  const iframe = findActiveIframe();
  if (!iframe?.src) {
    return;
  }

  chrome.runtime.sendMessage({
    type: "RESET_ACTIVE_IFRAME",
    frameUrl: iframe.src,
    keys: Array.isArray(event.detail?.keys) ? event.detail.keys : [],
  });
});
