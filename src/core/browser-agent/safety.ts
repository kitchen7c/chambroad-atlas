// src/core/browser-agent/safety.ts

import type { BrowserAction, PageSummary, ConfirmLevel } from './types';

// Sensitive URL patterns
const sensitiveUrlPatterns = [
  /checkout/i, /payment/i, /pay\//i, /billing/i,
  /login/i, /signin/i, /signup/i, /auth/i, /oauth/i,
  /delete/i, /remove/i, /cancel/i, /unsubscribe/i,
  /admin/i, /settings/i, /account/i, /profile/i,
  /bank/i, /transfer/i, /wire/i
];

// Sensitive content keywords
const sensitiveKeywords = [
  '确认支付', '立即支付', '删除账户', '注销', '取消订阅',
  '确认删除', '永久删除', '不可恢复',
  'confirm payment', 'delete account', 'unsubscribe',
  'permanently delete', 'cannot be undone', 'purchase', 'buy now'
];

// Actions that always require confirmation
const alwaysConfirmActions = ['executeJS', 'uploadFile'];

// Button text patterns that indicate sensitive actions
const sensitiveButtonPatterns = [
  /(submit|确认|提交|pay|支付|purchase|购买|order|下单)/i,
  /(delete|删除|remove|移除|cancel|取消|unsubscribe)/i
];

// Check if URL matches sensitive patterns
function isUrlSensitive(url: string): boolean {
  return sensitiveUrlPatterns.some(p => p.test(url));
}

// Check if content contains sensitive keywords
function contentContainsSensitive(text: string): boolean {
  const lowerText = text.toLowerCase();
  return sensitiveKeywords.some(k => lowerText.includes(k.toLowerCase()));
}

// Check if button text is sensitive
function isButtonSensitive(text: string): boolean {
  return sensitiveButtonPatterns.some(p => p.test(text));
}

// Determine confirmation level for an action
export function getConfirmLevel(
  action: BrowserAction,
  pageSummary: PageSummary
): ConfirmLevel {
  // Always confirm these actions
  if (alwaysConfirmActions.includes(action.action)) {
    return 'confirm';
  }

  const urlSensitive = isUrlSensitive(pageSummary.url);
  const contentSensitive = contentContainsSensitive(pageSummary.visibleText);

  // Click action on sensitive button
  if (action.action === 'click' && action.params) {
    const targetText = String(action.params.text || '');
    if (isButtonSensitive(targetText) && (urlSensitive || contentSensitive)) {
      return 'confirm';
    }
  }

  // Enter key on sensitive page (form submission)
  if (action.action === 'pressKey' && action.params?.key === 'Enter') {
    if (urlSensitive || contentSensitive) {
      return 'confirm';
    }
  }

  // Type action with sensitive content patterns (like credit card numbers)
  if (action.action === 'type' && action.params?.text) {
    const text = String(action.params.text);
    // Credit card pattern
    if (/\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/.test(text)) {
      return 'confirm';
    }
  }

  return 'auto';
}

// Format confirmation message
export function formatConfirmMessage(
  action: BrowserAction,
  pageSummary: PageSummary
): string {
  const actionDesc = describeAction(action);
  return `确认执行操作？\n\n操作: ${actionDesc}\n页面: ${pageSummary.url}`;
}

// Describe action in human-readable format
function describeAction(action: BrowserAction): string {
  const params = action.params || {};

  switch (action.action) {
    case 'click':
      if (params.index !== undefined) return `点击元素 #${params.index}`;
      if (params.selector) return `点击 ${params.selector}`;
      if (params.x !== undefined) return `点击坐标 (${params.x}, ${params.y})`;
      return '点击';
    case 'type':
      return `输入 "${String(params.text || '').slice(0, 20)}..."`;
    case 'navigate':
      return `跳转到 ${params.url}`;
    case 'pressKey':
      return `按键 ${params.key}`;
    case 'executeJS':
      return `执行 JavaScript`;
    case 'uploadFile':
      return `上传文件`;
    default:
      return action.action;
  }
}
