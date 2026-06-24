// Service worker: opens the side panel when the extension icon is clicked.
// State is never stored in variables (ephemeral SW) — chrome.storage is used instead.

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch(console.error);
