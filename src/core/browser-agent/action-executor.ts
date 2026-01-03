// src/core/browser-agent/action-executor.ts

import type { BrowserAction, ActionResult, PageSummary } from './types';

// Send message to content script via background
async function sendToContentScript(message: Record<string, unknown>): Promise<any> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, message: chrome.runtime.lastError.message });
      } else {
        resolve(response);
      }
    });
  });
}

// Execute a browser action
export async function executeAction(action: BrowserAction): Promise<ActionResult> {
  const { action: actionType, params = {} } = action;

  switch (actionType) {
    case 'getElements':
      return executeGetElements(params);
    case 'getElementDetails':
      return executeGetElementDetails(params);
    case 'click':
      return executeClick(params);
    case 'type':
      return executeType(params);
    case 'scroll':
      return executeScroll(params);
    case 'navigate':
      return executeNavigate(params);
    case 'wait':
      return executeWait(params);
    case 'hover':
      return executeHover(params);
    case 'select':
      return executeSelect(params);
    case 'pressKey':
      return executePressKey(params);
    case 'goBack':
      return executeGoBack();
    case 'goForward':
      return executeGoForward();
    case 'refresh':
      return executeRefresh();
    case 'screenshot':
      return executeScreenshot();
    case 'switchTab':
      return executeSwitchTab(params);
    case 'executeJS':
      return executeJS(params);
    case 'dragDrop':
      return executeDragDrop(params);
    case 'uploadFile':
      return { success: false, message: 'uploadFile not yet implemented' };
    default:
      return { success: false, message: `Unknown action: ${actionType}` };
  }
}

async function executeGetElements(params: Record<string, unknown>): Promise<ActionResult> {
  const response = await sendToContentScript({
    type: 'GET_ELEMENTS',
    filterType: params.type as string,
    visibleOnly: params.visible as boolean
  });
  if (response.elements) {
    return { success: true, message: `Found ${response.elements.length} elements`, data: response.elements };
  }
  return { success: false, message: 'Failed to get elements' };
}

async function executeGetElementDetails(params: Record<string, unknown>): Promise<ActionResult> {
  const indices = params.indices as number[];
  if (!Array.isArray(indices)) {
    return { success: false, message: 'indices must be an array' };
  }
  const response = await sendToContentScript({ type: 'GET_ELEMENT_DETAILS', indices });
  if (response.details) {
    return { success: true, message: `Got details for ${response.details.length} elements`, data: response.details };
  }
  return { success: false, message: 'Failed to get element details' };
}

async function executeClick(params: Record<string, unknown>): Promise<ActionResult> {
  if (params.index !== undefined) {
    return await sendToContentScript({ type: 'CLICK_BY_INDEX', index: params.index as number });
  }
  return await sendToContentScript({
    type: 'EXECUTE_ACTION',
    action: 'click',
    selector: params.selector as string,
    coordinates: params.x !== undefined ? { x: params.x, y: params.y } : undefined
  });
}

async function executeType(params: Record<string, unknown>): Promise<ActionResult> {
  if (params.clear) {
    await sendToContentScript({ type: 'EXECUTE_ACTION', action: 'clear_input' });
    await new Promise(r => setTimeout(r, 100));
  }
  return await sendToContentScript({
    type: 'EXECUTE_ACTION',
    action: 'keyboard_type',
    value: params.text as string
  });
}

async function executeScroll(params: Record<string, unknown>): Promise<ActionResult> {
  return await sendToContentScript({
    type: 'EXECUTE_ACTION',
    action: 'scroll',
    direction: params.direction as string,
    amount: params.amount as number,
    selector: params.selector as string
  });
}

async function executeNavigate(params: Record<string, unknown>): Promise<ActionResult> {
  const url = params.url as string;
  if (!url) return { success: false, message: 'URL is required' };
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'NAVIGATE', url }, (response) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, message: chrome.runtime.lastError.message || 'Unknown error' });
      } else {
        resolve(response as ActionResult);
      }
    });
  });
}

async function executeWait(params: Record<string, unknown>): Promise<ActionResult> {
  const ms = (params.ms as number) || 1000;
  await new Promise(r => setTimeout(r, ms));
  return { success: true, message: `Waited ${ms}ms` };
}

async function executeHover(params: Record<string, unknown>): Promise<ActionResult> {
  return await sendToContentScript({
    type: 'EXECUTE_ACTION',
    action: 'hover',
    coordinates: { x: params.x, y: params.y }
  });
}

async function executeSelect(params: Record<string, unknown>): Promise<ActionResult> {
  if (params.index !== undefined) {
    await sendToContentScript({ type: 'CLICK_BY_INDEX', index: params.index as number });
  } else if (params.selector) {
    await sendToContentScript({ type: 'EXECUTE_ACTION', action: 'click', selector: params.selector as string });
  }
  return await sendToContentScript({ type: 'EXECUTE_ACTION', action: 'fill', value: params.value as string });
}

async function executePressKey(params: Record<string, unknown>): Promise<ActionResult> {
  const keys = params.modifiers
    ? [...(params.modifiers as string[]), params.key as string]
    : [params.key as string];
  return await sendToContentScript({ type: 'EXECUTE_ACTION', action: 'key_combination', keys });
}

async function executeGoBack(): Promise<ActionResult> {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, message: chrome.runtime.lastError.message || 'Unknown error' });
        return;
      }
      if (tabs[0]?.id) {
        chrome.tabs.goBack(tabs[0].id);
        setTimeout(() => resolve({ success: true, message: 'Navigated back' }), 500);
      } else {
        resolve({ success: false, message: 'No active tab' });
      }
    });
  });
}

async function executeGoForward(): Promise<ActionResult> {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, message: chrome.runtime.lastError.message || 'Unknown error' });
        return;
      }
      if (tabs[0]?.id) {
        chrome.tabs.goForward(tabs[0].id);
        setTimeout(() => resolve({ success: true, message: 'Navigated forward' }), 500);
      } else {
        resolve({ success: false, message: 'No active tab' });
      }
    });
  });
}

async function executeRefresh(): Promise<ActionResult> {
  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, message: chrome.runtime.lastError.message || 'Unknown error' });
        return;
      }
      if (tabs[0]?.id) {
        chrome.tabs.reload(tabs[0].id);
        setTimeout(() => resolve({ success: true, message: 'Page refreshed' }), 500);
      } else {
        resolve({ success: false, message: 'No active tab' });
      }
    });
  });
}

async function executeScreenshot(): Promise<ActionResult> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'TAKE_SCREENSHOT' }, (response) => {
      if (response?.screenshot) {
        resolve({ success: true, message: 'Screenshot captured', data: response.screenshot });
      } else {
        resolve({ success: false, message: response?.error || 'Failed to capture screenshot' });
      }
    });
  });
}

async function executeSwitchTab(params: Record<string, unknown>): Promise<ActionResult> {
  return new Promise((resolve) => {
    if (params.index !== undefined) {
      chrome.tabs.query({}, (tabs) => {
        if (chrome.runtime.lastError) {
          resolve({ success: false, message: chrome.runtime.lastError.message || 'Unknown error' });
          return;
        }
        const tab = tabs[params.index as number];
        if (tab?.id) {
          chrome.tabs.update(tab.id, { active: true });
          resolve({ success: true, message: `Switched to tab ${params.index}` });
        } else {
          resolve({ success: false, message: `Tab ${params.index} not found` });
        }
      });
    } else if (params.url) {
      chrome.tabs.query({ url: params.url as string }, (tabs) => {
        if (chrome.runtime.lastError) {
          resolve({ success: false, message: chrome.runtime.lastError.message || 'Unknown error' });
          return;
        }
        if (tabs[0]?.id) {
          chrome.tabs.update(tabs[0].id, { active: true });
          resolve({ success: true, message: `Switched to tab with URL ${params.url}` });
        } else {
          resolve({ success: false, message: `Tab with URL ${params.url} not found` });
        }
      });
    } else {
      resolve({ success: false, message: 'index or url required' });
    }
  });
}

// SECURITY NOTE: This function uses eval() to execute arbitrary JavaScript code on the page.
// This is intentional functionality for browser automation but should only be used with
// trusted input from the AI agent, never with unsanitized user input.
async function executeJS(params: Record<string, unknown>): Promise<ActionResult> {
  const code = params.code as string;
  if (!code) return { success: false, message: 'code is required' };

  return new Promise((resolve) => {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (chrome.runtime.lastError) {
        resolve({ success: false, message: chrome.runtime.lastError.message || 'Unknown error' });
        return;
      }
      if (!tabs[0]?.id) {
        resolve({ success: false, message: 'No active tab' });
        return;
      }
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          func: (code: string) => {
            try {
              // eslint-disable-next-line no-eval
              return { success: true, result: eval(code) };
            } catch (e) {
              return { success: false, error: String(e) };
            }
          },
          args: [code]
        });
        const result = results[0]?.result;
        if (result?.success) {
          resolve({ success: true, message: 'JS executed', data: result.result });
        } else {
          resolve({ success: false, message: result?.error || 'JS execution failed' });
        }
      } catch (e) {
        resolve({ success: false, message: String(e) });
      }
    });
  });
}

async function executeDragDrop(params: Record<string, unknown>): Promise<ActionResult> {
  const from = params.from as { x: number; y: number };
  const to = params.to as { x: number; y: number };
  if (!from || !to) return { success: false, message: 'from and to coordinates required' };
  return await sendToContentScript({
    type: 'EXECUTE_ACTION',
    action: 'drag_drop',
    coordinates: from,
    destination: to
  });
}

// Get page summary
export async function getPageSummary(): Promise<PageSummary> {
  const response = await sendToContentScript({ type: 'GET_PAGE_SUMMARY' });
  return response as PageSummary;
}
