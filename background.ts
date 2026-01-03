// Background service worker for the extension

// Memory store for browser context
interface BrowserMemory {
  recentPages: Array<{ url: string; title: string; timestamp: number; context?: any }>;
  userPreferences: Record<string, any>;
  sessionData: Record<string, any>;
}

const memory: BrowserMemory = {
  recentPages: [],
  userPreferences: {},
  sessionData: {}
};

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

async function openAtlasUiFallback() {
  await chrome.tabs.create({ url: chrome.runtime.getURL('sidepanel.html') });
}

async function configureActionUi() {
  // In Chrome with Side Panel support, prefer opening the side panel on action click.
  // In browsers without Side Panel (e.g. Arc), keep a popup so the user still has a clickable entrypoint.
  type SidePanelApi = {
    setPanelBehavior: (options: { openPanelOnActionClick: boolean }) => Promise<void> | void;
    open: (options: { tabId: number }) => Promise<void> | void;
  };

  const sidePanel = (chrome as unknown as { sidePanel?: Partial<SidePanelApi> }).sidePanel;
  const hasSidePanel =
    typeof sidePanel?.setPanelBehavior === 'function' && typeof sidePanel?.open === 'function';

  try {
    if (hasSidePanel) {
      await sidePanel!.setPanelBehavior!({ openPanelOnActionClick: true });
      await chrome.action.setPopup({ popup: '' });
    } else {
      await chrome.action.setPopup({ popup: 'popup.html' });
    }
  } catch (error) {
    console.error('[Atlas] Failed to configure action UI:', error);
    try {
      await chrome.action.setPopup({ popup: 'popup.html' });
    } catch {
      // ignore
    }
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void configureActionUi();
});

chrome.runtime.onStartup?.addListener(() => {
  void configureActionUi();
});

// Listen for extension icon clicks
chrome.action.onClicked.addListener((tab) => {
  (async () => {
    try {
      // Best-effort: make sure Chrome is configured correctly even if the service worker started late.
      await configureActionUi();

      const sidePanel = (chrome as unknown as { sidePanel?: { open?: unknown } }).sidePanel;
      if (typeof sidePanel?.open !== 'function') {
        await openAtlasUiFallback();
        return;
      }

      const tabId = tab.id;
      if (!tabId || isRestrictedTabUrl(tab.url)) {
        await openAtlasUiFallback();
        return;
      }

      await (sidePanel.open as (options: { tabId: number }) => Promise<void> | void)({ tabId });
    } catch (error) {
      console.error('[Atlas] Failed to open UI:', error);
      try {
        await openAtlasUiFallback();
      } catch {
        // ignore
      }
    }
  })();
});

// Track page visits for memory
chrome.webNavigation.onCompleted.addListener((details) => {
  if (details.frameId === 0) { // Main frame only
    chrome.tabs.get(details.tabId, (tab) => {
      if (tab.url && tab.title) {
        addToMemory({
          url: tab.url,
          title: tab.title,
          timestamp: Date.now()
        });
      }
    });
  }
});

// Add page to memory
function addToMemory(page: { url: string; title: string; timestamp: number }) {
  memory.recentPages.unshift(page);
  if (memory.recentPages.length > 100) {
    memory.recentPages.pop();
  }

  // Save to chrome.storage for persistence
  chrome.storage.local.set({ browserMemory: memory });
}

// Load memory from storage on startup
chrome.storage.local.get('browserMemory', (result) => {
  if (result.browserMemory) {
    Object.assign(memory, result.browserMemory);
  }
});

// Listen for messages from the sidebar and content scripts
chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  // Get current tab info
  if (request.type === 'GET_TAB_INFO') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        sendResponse({
          url: tabs[0].url,
          title: tabs[0].title,
          id: tabs[0].id
        });
      }
    });
    return true;
  }

  // Get browser history
  if (request.type === 'GET_HISTORY') {
    const query = request.query || '';
    const maxResults = request.maxResults || 100;
    const startTime = request.startTime || Date.now() - (7 * 24 * 60 * 60 * 1000); // Last 7 days

    chrome.history.search({
      text: query,
      maxResults,
      startTime
    }, (results) => {
      sendResponse({ history: results });
    });
    return true;
  }

  // Get browser memory
  if (request.type === 'GET_MEMORY') {
    sendResponse({ memory });
    return true;
  }

  // Get page context from content script
  // Helper function to ensure content script is injected
  async function ensureContentScript(tabId: number): Promise<void> {
    try {
      // Try to ping the content script
      await chrome.tabs.sendMessage(tabId, { type: 'PING' });
    } catch (error) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId },
          files: ['content.js']
        });
        // Wait a bit for the script to initialize
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (injectError) {
        throw injectError;
      }
    }
  }

  if (request.type === 'GET_PAGE_CONTEXT') {
    (async () => {
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const tab = tabs[0];
        if (tab?.id) {
          if (isRestrictedTabUrl(tab.url)) {
            sendResponse({
              success: false,
              error: '无法访问该页面（chrome:// 等浏览器内部页面无法被扩展读取）。请打开普通网页（http/https）后再试。',
              url: tab.url,
            });
            return;
          }

          await ensureContentScript(tab.id);
          const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_PAGE_CONTEXT' });
          sendResponse(response); // Return response directly, not wrapped
        } else {
          sendResponse({ success: false, error: 'No active tab found' });
        }
      } catch (error) {
        sendResponse({ success: false, error: (error as Error).message });
      }
    })();
    return true;
  }

  if (request.type === 'GET_SELECTED_TEXT') {
    (async () => {
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const tab = tabs[0];
        if (tab?.id) {
          if (isRestrictedTabUrl(tab.url)) {
            sendResponse({
              success: false,
              error: '无法访问该页面（chrome:// 等浏览器内部页面无法被扩展读取）。请打开普通网页（http/https）后再试。',
              url: tab.url,
              text: '',
            });
            return;
          }

          await ensureContentScript(tab.id);
          const response = await chrome.tabs.sendMessage(tab.id, { type: 'GET_SELECTED_TEXT' });
          sendResponse(response);
        } else {
          sendResponse({ success: false, error: 'No active tab found' });
        }
      } catch (error) {
        sendResponse({ success: false, error: (error as Error).message });
      }
    })();
    return true;
  }

  // Execute action on page
  if (request.type === 'EXECUTE_ACTION') {
    (async () => {
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const tab = tabs[0];
        if (tab?.id) {
          if (isRestrictedTabUrl(tab.url)) {
            sendResponse({
              success: false,
              error: '无法在该页面执行操作（chrome:// 等浏览器内部页面不允许扩展注入脚本）。请打开普通网页（http/https）后再试。',
              url: tab.url,
            });
            return;
          }

          await ensureContentScript(tab.id);
          const response = await chrome.tabs.sendMessage(tab.id, {
            type: 'EXECUTE_ACTION',
            action: request.action,
            target: request.target,
            selector: request.selector,
            value: request.value,
            key: request.key,
            keys: request.keys,
            coordinates: request.coordinates,
            destination: request.destination,
            direction: request.direction,
            amount: request.amount
          });
          sendResponse(response);
        } else {
          sendResponse({ success: false, error: 'No active tab found' });
        }
      } catch (error) {
        sendResponse({ success: false, error: (error as Error).message });
      }
    })();
    return true;
  }

  // Forward page summary request to content script
  if (request.type === 'GET_PAGE_SUMMARY') {
    (async () => {
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const tab = tabs[0];
        if (tab?.id) {
          if (isRestrictedTabUrl(tab.url)) {
            sendResponse({
              success: false,
              error: '无法访问该页面',
              url: tab.url,
            });
            return;
          }
          await ensureContentScript(tab.id);
          const response = await chrome.tabs.sendMessage(tab.id, request);
          sendResponse(response);
        } else {
          sendResponse({ error: 'No active tab' });
        }
      } catch (error) {
        sendResponse({ error: (error as Error).message });
      }
    })();
    return true;
  }

  // Forward element requests to content script
  if (request.type === 'GET_ELEMENTS' || request.type === 'GET_ELEMENT_DETAILS' || request.type === 'CLICK_BY_INDEX') {
    (async () => {
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const tab = tabs[0];
        if (tab?.id) {
          if (isRestrictedTabUrl(tab.url)) {
            sendResponse({
              success: false,
              error: '无法访问该页面',
              url: tab.url,
            });
            return;
          }
          await ensureContentScript(tab.id);
          const response = await chrome.tabs.sendMessage(tab.id, request);
          sendResponse(response);
        } else {
          sendResponse({ error: 'No active tab' });
        }
      } catch (error) {
        sendResponse({ error: (error as Error).message });
      }
    })();
    return true;
  }

  // Take screenshot
  if (request.type === 'TAKE_SCREENSHOT') {
    (async () => {
      try {

        // Define restricted protocols (but allow regular web pages)
        const restrictedProtocols = ['chrome://', 'chrome-extension://', 'edge://', 'about:', 'devtools://'];
        const isRestricted = (url: string | undefined) => {
          if (!url) return true;
          // Allow http:// and https:// pages (including google.com)
          if (url.startsWith('http://') || url.startsWith('https://')) return false;
          // Block internal browser pages
          return restrictedProtocols.some(protocol => url.startsWith(protocol));
        };

        // Get the currently focused window with windowTypes to exclude devtools
        const currentWindow = await chrome.windows.getLastFocused({
          populate: true,
          windowTypes: ['normal']
        });

        if (!currentWindow || !currentWindow.tabs) {
          console.error('❌ No focused window found');
          sendResponse({ success: false, error: 'No browser window found' });
          return;
        }

        // Get the active AND highlighted tab (the one that's actually visible to the user)
        let activeTab = currentWindow.tabs.find(tab => tab.active === true && tab.highlighted === true);

        // Fallback to just active if highlighted not found
        if (!activeTab) {
          activeTab = currentWindow.tabs.find(tab => tab.active === true);
        }

        if (!activeTab) {
          console.error('❌ No active tab found in window');
          sendResponse({ success: false, error: 'No active tab found' });
          return;
        }


        // Check if the current tab is restricted
        if (isRestricted(activeTab.url)) {
          // Navigate to google.com automatically
          if (activeTab.id) {
            await chrome.tabs.update(activeTab.id, { url: 'https://www.google.com' });

            // Wait for the page to load
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Get the updated tab
            const updatedTab = await chrome.tabs.get(activeTab.id);

            // Update activeTab reference
            activeTab = updatedTab;
          } else {
            sendResponse({
              success: false,
              error: 'Cannot navigate from restricted page'
            });
            return;
          }
        }


        // Ensure windowId is defined
        if (currentWindow.id === undefined) {
          throw new Error('Window ID is undefined');
        }

        // Capture the visible tab in the current window
        const dataUrl = await chrome.tabs.captureVisibleTab(currentWindow.id, {
          format: 'png',
          quality: 80
        });

        sendResponse({ success: true, screenshot: dataUrl });
      } catch (error) {
        console.error('❌ Screenshot capture error:', error);

        // Provide more detailed error information
        const errorMsg = error instanceof Error ? error.message : String(error);
        console.error('Error details:', errorMsg);
        sendResponse({
          success: false,
          error: `Screenshot failed: ${errorMsg}`
        });
      }
    })().catch(err => {
      // Handle unhandled promise rejections from the IIFE
      console.error('[SCREENSHOT] Unhandled promise rejection:', err instanceof Error ? err.message : String(err));
    });
    return true;
  }

  // Navigate to URL
  if (request.type === 'NAVIGATE') {
    (async () => {
      try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs[0]?.id) {
          await chrome.tabs.update(tabs[0].id, { url: request.url });
          sendResponse({ success: true, url: request.url });
        } else {
          sendResponse({ success: false, error: 'No active tab found' });
        }
      } catch (error) {
        sendResponse({ success: false, error: (error as Error).message });
      }
    })();
    return true;
  }

  if (request.type === 'EXECUTE_SCRIPT') {
    sendResponse({
      success: false,
      error: 'EXECUTE_SCRIPT is disabled for security reasons. Use content script messaging instead.'
    });
    return true;
  }

  // Get bookmarks
  if (request.type === 'GET_BOOKMARKS') {
    chrome.bookmarks.getTree((bookmarkTree) => {
      sendResponse({ bookmarks: bookmarkTree });
    });
    return true;
  }

  // Store in memory
  if (request.type === 'STORE_MEMORY') {
    const { key, value } = request;
    memory.sessionData[key] = value;
    chrome.storage.local.set({ browserMemory: memory });
    sendResponse({ success: true });
    return true;
  }

  // Page loaded notification from content script
  if (request.type === 'PAGE_LOADED') {
    console.log('Page loaded:', request.url);
    return false;
  }
});

console.log('Atlas background service worker loaded');
