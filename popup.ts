function isRestrictedTabUrl(url: string | undefined) {
  if (!url) return true;
  return [
    'chrome://',
    'chrome-extension://',
    'edge://',
    'about:',
    'devtools://',
  ].some((prefix) => url.startsWith(prefix));
}

async function openAtlasUiInTab() {
  await chrome.tabs.create({ url: chrome.runtime.getURL('sidepanel.html') });
  window.close();
}

(async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = tab?.id;

    if (!tabId || isRestrictedTabUrl(tab?.url) || !chrome.sidePanel?.open) {
      await openAtlasUiInTab();
      return;
    }

    try {
      await chrome.sidePanel.open({ tabId });
      window.close();
    } catch {
      await openAtlasUiInTab();
    }
  } catch {
    await openAtlasUiInTab();
  }
})();
