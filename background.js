/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Configure side panel behavior to open on action click (extension icon click)
chrome.runtime.onInstalled.addListener(() => {
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
      .catch((error) => console.error("Error setting sidePanel behavior:", error));
  }
});
