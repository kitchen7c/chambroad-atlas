# Atlas UI Redesign Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign the Chrome extension UI with clean minimal styling and tab-based navigation for knowledge workers.

**Architecture:** Replace cryptic icon buttons with explicit text tabs (Chat/Sources/Articles). Move to light theme with neutral monochrome palette. Restructure input area with labeled Browser Tools toggle.

**Tech Stack:** React, CSS (no Tailwind), TypeScript

---

## Task 1: Add CSS Variables

**Files:**
- Modify: `sidepanel.css:1-15`

**Step 1: Add CSS custom properties at the top of sidepanel.css**

Replace the `*` reset block with:

```css
:root {
  --text-primary: #111827;
  --text-secondary: #6b7280;
  --text-disabled: #9ca3af;
  --bg-primary: #ffffff;
  --bg-surface: #f9fafb;
  --bg-hover: #f3f4f6;
  --border: #e5e7eb;
  --border-light: #f3f4f6;
  --accent: #2563eb;
  --accent-hover: #1d4ed8;
  --success: #22c55e;
  --warning: #f59e0b;
  --error: #ef4444;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
```

**Step 2: Verify build succeeds**

Run: `npm run build`
Expected: Build completes without errors

**Step 3: Commit**

```bash
git add sidepanel.css
git commit -m "style: add CSS custom properties for design system"
```

---

## Task 2: Create TabBar Component

**Files:**
- Create: `src/components/TabBar.tsx`

**Step 1: Create the TabBar component**

```tsx
import { useTranslation } from 'react-i18next';

export type TabType = 'chat' | 'sources' | 'articles';

interface TabBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  const { t } = useTranslation();

  const tabs: { id: TabType; label: string }[] = [
    { id: 'chat', label: t('tabs.chat', 'Chat') },
    { id: 'sources', label: t('tabs.sources', 'Sources') },
    { id: 'articles', label: t('tabs.articles', 'Articles') },
  ];

  return (
    <div className="tab-bar">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          className={`tab-item ${activeTab === tab.id ? 'active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
```

**Step 2: Add TabBar styles to sidepanel.css**

Add after the `.chat-header` styles (around line 50):

```css
/* ===== Tab Bar ===== */
.tab-bar {
  display: flex;
  gap: 0;
  padding: 0 16px;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--border);
}

.tab-item {
  padding: 12px 16px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.tab-item:hover {
  color: var(--text-primary);
}

.tab-item.active {
  color: var(--text-primary);
  border-bottom-color: var(--accent);
}
```

**Step 3: Verify build succeeds**

Run: `npm run build`
Expected: Build completes without errors

**Step 4: Commit**

```bash
git add src/components/TabBar.tsx sidepanel.css
git commit -m "feat: add TabBar component for navigation"
```

---

## Task 3: Create Toggle Component

**Files:**
- Create: `src/components/Toggle.tsx`

**Step 1: Create the Toggle component**

```tsx
interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  hint?: string;
}

export function Toggle({ label, checked, onChange, disabled, hint }: ToggleProps) {
  return (
    <div className="toggle-container">
      <span className="toggle-label">{label}</span>
      <div className="toggle-control">
        <button
          type="button"
          className={`toggle-option ${!checked ? 'active' : ''}`}
          onClick={() => onChange(false)}
          disabled={disabled}
        >
          Off
        </button>
        <button
          type="button"
          className={`toggle-option ${checked ? 'active' : ''}`}
          onClick={() => onChange(true)}
          disabled={disabled}
        >
          On
        </button>
      </div>
      {hint && <span className="toggle-hint">{hint}</span>}
    </div>
  );
}
```

**Step 2: Add Toggle styles to sidepanel.css**

Add after TabBar styles:

```css
/* ===== Toggle ===== */
.toggle-container {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 0;
}

.toggle-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.toggle-control {
  display: flex;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  overflow: hidden;
}

.toggle-option {
  padding: 6px 12px;
  background: none;
  border: none;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
}

.toggle-option:hover:not(:disabled) {
  color: var(--text-primary);
}

.toggle-option.active {
  background: var(--accent);
  color: white;
}

.toggle-option:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.toggle-hint {
  font-size: 11px;
  color: var(--text-disabled);
}
```

**Step 3: Verify build succeeds**

Run: `npm run build`
Expected: Build completes without errors

**Step 4: Commit**

```bash
git add src/components/Toggle.tsx sidepanel.css
git commit -m "feat: add Toggle component for Browser Tools"
```

---

## Task 4: Update Header Component

**Files:**
- Modify: `sidepanel.tsx:1299-1341`
- Modify: `sidepanel.css:23-90`

**Step 1: Update header styles in sidepanel.css**

Replace the `.chat-header` block:

```css
.chat-header {
  padding: 16px;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.chat-header h1 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.icon-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s ease;
  font-size: 14px;
}

.icon-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-color: var(--text-disabled);
}

.icon-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

**Step 2: Update header JSX in sidepanel.tsx**

Find the header section (around line 1299) and replace with:

```tsx
<div className="chat-header">
  <h1>Atlas</h1>
  <div className="header-actions">
    <button
      onClick={openSettings}
      className="icon-btn"
      title="Settings"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
      </svg>
    </button>
  </div>
</div>
```

**Step 3: Verify build succeeds**

Run: `npm run build`
Expected: Build completes without errors

**Step 4: Commit**

```bash
git add sidepanel.tsx sidepanel.css
git commit -m "style: update header with minimal design"
```

---

## Task 5: Integrate TabBar into Sidepanel

**Files:**
- Modify: `sidepanel.tsx`

**Step 1: Add TabBar import at top of sidepanel.tsx**

Add with other imports:

```tsx
import { TabBar, TabType } from './src/components/TabBar';
```

**Step 2: Update ViewState type and add tab state**

Replace the ViewState type and add activeTab state (around line 13):

```tsx
type ViewState =
  | { type: 'chat' }
  | { type: 'sources' }
  | { type: 'articles'; sourceId?: string }
  | { type: 'article'; articleId: string };

// Inside ChatSidebar function, add:
const [activeTab, setActiveTab] = useState<TabType>('chat');
```

**Step 3: Add tab change handler**

Add after the state declarations:

```tsx
const handleTabChange = (tab: TabType) => {
  setActiveTab(tab);
  if (tab === 'chat') {
    setView({ type: 'chat' });
  } else if (tab === 'sources') {
    setView({ type: 'sources' });
  } else if (tab === 'articles') {
    setView({ type: 'articles' });
  }
};
```

**Step 4: Update the return statement to include TabBar**

After the header, add the TabBar:

```tsx
<div className="chat-header">
  <h1>Atlas</h1>
  <div className="header-actions">
    <button onClick={openSettings} className="icon-btn" title="Settings">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="3"/>
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
      </svg>
    </button>
  </div>
</div>

<TabBar activeTab={activeTab} onTabChange={handleTabChange} />
```

**Step 5: Verify build succeeds**

Run: `npm run build`
Expected: Build completes without errors

**Step 6: Commit**

```bash
git add sidepanel.tsx
git commit -m "feat: integrate TabBar navigation"
```

---

## Task 6: Update Input Area

**Files:**
- Modify: `sidepanel.tsx`
- Modify: `sidepanel.css`

**Step 1: Add Toggle import**

```tsx
import { Toggle } from './src/components/Toggle';
```

**Step 2: Update input form styles in sidepanel.css**

Replace the `.input-form` and related styles:

```css
/* ===== Input Area ===== */
.input-area {
  padding: 12px 16px 16px;
  background: var(--bg-primary);
  border-top: 1px solid var(--border);
}

.input-controls {
  margin-bottom: 12px;
}

.input-form {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

.chat-input {
  flex: 1;
  padding: 12px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  font-size: 15px;
  font-family: inherit;
  outline: none;
  transition: all 0.15s ease;
  background: var(--bg-surface);
  color: var(--text-primary);
  resize: none;
  min-height: 44px;
  max-height: 200px;
  line-height: 1.4;
}

.chat-input:hover {
  border-color: var(--text-disabled);
}

.chat-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1);
}

.chat-input:disabled {
  background: var(--bg-hover);
  color: var(--text-disabled);
  cursor: not-allowed;
}

.chat-input::placeholder {
  color: var(--text-disabled);
}

.send-button {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.15s ease;
  flex-shrink: 0;
}

.send-button:hover:not(:disabled) {
  background: var(--accent-hover);
}

.send-button:disabled {
  background: var(--bg-hover);
  color: var(--text-disabled);
  cursor: not-allowed;
}

.send-button.stop-button {
  background: var(--text-secondary);
}

.send-button.stop-button:hover {
  background: var(--text-primary);
}

.input-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

.new-chat-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: color 0.15s ease;
}

.new-chat-btn:hover {
  color: var(--text-primary);
}

.new-chat-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

**Step 3: Update input area JSX in sidepanel.tsx**

Replace the form section (around line 1392):

```tsx
<div className="input-area">
  <div className="input-controls">
    <Toggle
      label="Browser Tools"
      checked={browserToolsEnabled}
      onChange={toggleBrowserTools}
      disabled={isLoading}
      hint={browserToolsEnabled ? 'Using Gemini Computer Use' : undefined}
    />
  </div>

  <form className="input-form" onSubmit={handleSubmit}>
    <input
      type="text"
      value={input}
      onChange={(e) => setInput(e.target.value)}
      placeholder="Ask Atlas anything..."
      disabled={isLoading}
      className="chat-input"
    />
    {isLoading ? (
      <button type="button" onClick={stop} className="send-button stop-button">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="6" width="12" height="12" rx="2"/>
        </svg>
      </button>
    ) : (
      <button type="submit" disabled={!input.trim()} className="send-button">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
        </svg>
      </button>
    )}
  </form>

  <div className="input-footer">
    <button onClick={newChat} className="new-chat-btn" disabled={isLoading}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15"/>
      </svg>
      New Chat
    </button>
  </div>
</div>
```

**Step 4: Verify build succeeds**

Run: `npm run build`
Expected: Build completes without errors

**Step 5: Commit**

```bash
git add sidepanel.tsx sidepanel.css
git commit -m "style: redesign input area with toggle and new layout"
```

---

## Task 7: Update Message Styles

**Files:**
- Modify: `sidepanel.css`

**Step 1: Update message styles**

Replace the `.message` and `.message-content` styles:

```css
/* ===== Messages ===== */
.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: var(--bg-primary);
}

.messages-container::-webkit-scrollbar {
  width: 6px;
}

.messages-container::-webkit-scrollbar-track {
  background: transparent;
}

.messages-container::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 3px;
}

.messages-container::-webkit-scrollbar-thumb:hover {
  background: var(--text-disabled);
}

.message {
  display: flex;
  margin-bottom: 8px;
  animation: fadeIn 0.2s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message.user {
  justify-content: flex-end;
}

.message.assistant {
  justify-content: flex-start;
}

.message-content {
  max-width: 85%;
  padding: 12px 16px;
  line-height: 1.5;
  font-size: 14px;
  word-wrap: break-word;
  white-space: normal;
  border-radius: var(--radius-lg);
}

.message.user .message-content {
  background: var(--bg-hover);
  color: var(--text-primary);
  border-bottom-right-radius: 4px;
}

.message.assistant .message-content {
  background: var(--bg-primary);
  border: 1px solid var(--border);
  color: var(--text-primary);
  border-bottom-left-radius: 4px;
}

/* Markdown in messages */
.message.assistant .message-content p {
  margin: 0 0 8px 0;
}

.message.assistant .message-content p:last-child {
  margin-bottom: 0;
}

.message.assistant .message-content code {
  background: var(--bg-surface);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
  font-size: 13px;
}

.message.assistant .message-content pre {
  background: #1e293b;
  color: #e2e8f0;
  padding: 12px;
  border-radius: var(--radius-md);
  overflow-x: auto;
  margin: 8px 0;
}

.message.assistant .message-content pre code {
  background: transparent;
  padding: 0;
  color: inherit;
}

.message.assistant .message-content ul,
.message.assistant .message-content ol {
  margin: 8px 0;
  padding-left: 20px;
}

.message.assistant .message-content a {
  color: var(--accent);
  text-decoration: none;
}

.message.assistant .message-content a:hover {
  text-decoration: underline;
}
```

**Step 2: Verify build succeeds**

Run: `npm run build`
Expected: Build completes without errors

**Step 3: Commit**

```bash
git add sidepanel.css
git commit -m "style: update message bubbles for light theme"
```

---

## Task 8: Update Welcome State

**Files:**
- Modify: `sidepanel.tsx`
- Modify: `sidepanel.css`

**Step 1: Update welcome message styles**

Replace `.welcome-message` styles:

```css
/* ===== Welcome State ===== */
.welcome-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  padding: 32px 24px;
}

.welcome-message h2 {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--text-primary);
}

.welcome-message p {
  font-size: 14px;
  line-height: 1.5;
  max-width: 280px;
  color: var(--text-secondary);
  margin-bottom: 20px;
}

.welcome-cta {
  padding: 10px 20px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
}

.welcome-cta:hover {
  background: var(--bg-hover);
  border-color: var(--text-disabled);
}
```

**Step 2: Update welcome JSX in sidepanel.tsx**

Find the welcome message section (around line 1359) and replace:

```tsx
<div className="welcome-message">
  <h2>Welcome to Atlas</h2>
  <p>Ask anything or enable Browser Tools to automate your browser.</p>
  {!browserToolsEnabled && (
    <button className="welcome-cta" onClick={toggleBrowserTools}>
      Enable Browser Tools
    </button>
  )}
</div>
```

**Step 3: Verify build succeeds**

Run: `npm run build`
Expected: Build completes without errors

**Step 4: Commit**

```bash
git add sidepanel.tsx sidepanel.css
git commit -m "style: update welcome state design"
```

---

## Task 9: Update Container and Body Styles

**Files:**
- Modify: `sidepanel.css`

**Step 1: Update body and container base styles**

Update the body and .chat-container styles near the top:

```css
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background: var(--bg-primary);
  color: var(--text-primary);
}

.chat-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-width: 100%;
  background: var(--bg-primary);
}
```

**Step 2: Remove dark-mode class usage from sidepanel.tsx**

Search for `dark-mode` class and remove it from all elements. The container should just be:

```tsx
<div className="chat-container">
```

Not:

```tsx
<div className="chat-container dark-mode">
```

**Step 3: Verify build succeeds**

Run: `npm run build`
Expected: Build completes without errors

**Step 4: Commit**

```bash
git add sidepanel.tsx sidepanel.css
git commit -m "style: switch to light theme as default"
```

---

## Task 10: Update SourceCard Component

**Files:**
- Modify: `src/components/SourceCard.tsx`
- Modify: `sidepanel.css`

**Step 1: Update source card styles**

Replace the `.source-card` related styles:

```css
/* ===== Source Card ===== */
.source-card {
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 14px 16px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  position: relative;
}

.source-card:hover {
  border-color: var(--text-disabled);
  background: var(--bg-surface);
}

.source-card.disabled {
  opacity: 0.5;
}

.source-card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 4px;
}

.source-card-icon {
  font-size: 16px;
}

.source-card-name {
  flex: 1;
  font-weight: 500;
  font-size: 14px;
  color: var(--text-primary);
}

.source-card-menu-btn {
  background: none;
  border: none;
  color: var(--text-disabled);
  cursor: pointer;
  padding: 4px 8px;
  font-size: 14px;
  border-radius: 4px;
}

.source-card-menu-btn:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}

.source-card-info {
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}

.source-card-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--text-disabled);
  margin-top: 4px;
}

.source-card-unread {
  color: var(--accent);
  font-weight: 500;
}

.source-card-error {
  margin-top: 8px;
  font-size: 12px;
  color: var(--error);
}

.source-card-menu {
  position: absolute;
  top: 44px;
  right: 12px;
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  z-index: 100;
  overflow: hidden;
}

.source-card-menu button {
  display: block;
  width: 100%;
  padding: 10px 16px;
  background: none;
  border: none;
  color: var(--text-primary);
  text-align: left;
  cursor: pointer;
  font-size: 13px;
}

.source-card-menu button:hover {
  background: var(--bg-hover);
}

.source-card-menu button.danger {
  color: var(--error);
}
```

**Step 2: Verify build succeeds**

Run: `npm run build`
Expected: Build completes without errors

**Step 3: Commit**

```bash
git add sidepanel.css
git commit -m "style: update source card for light theme"
```

---

## Task 11: Update ArticleCard Component

**Files:**
- Modify: `sidepanel.css`

**Step 1: Update article card styles**

Replace the `.article-card` related styles:

```css
/* ===== Article Card ===== */
.article-card {
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 12px 16px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.article-card:hover {
  border-color: var(--text-disabled);
  background: var(--bg-surface);
}

.article-card.read {
  opacity: 0.7;
}

.article-card-title {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 4px;
  line-height: 1.4;
}

.article-card-indicators {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.unread-dot {
  color: var(--accent);
  font-size: 8px;
}

.favorite-star {
  color: var(--warning);
  font-size: 12px;
}

.article-card-meta {
  display: flex;
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}

.article-card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 8px;
}

.article-tag {
  display: inline-block;
  padding: 2px 8px;
  background: var(--bg-surface);
  border-radius: 10px;
  font-size: 11px;
  color: var(--text-secondary);
}
```

**Step 2: Verify build succeeds**

Run: `npm run build`
Expected: Build completes without errors

**Step 3: Commit**

```bash
git add sidepanel.css
git commit -m "style: update article card for light theme"
```

---

## Task 12: Update Views and Forms

**Files:**
- Modify: `sidepanel.css`

**Step 1: Update view header and form styles**

Replace the view-related styles:

```css
/* ===== View Header ===== */
.view-header {
  padding: 12px 16px;
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 12px;
}

.view-header-back {
  background: none;
  border: none;
  color: var(--text-secondary);
  font-size: 18px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
}

.view-header-back:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.view-header-title {
  flex: 1;
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.view-header-action {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  color: var(--text-primary);
  padding: 8px 14px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
}

.view-header-action:hover {
  background: var(--bg-hover);
}

/* ===== Sources/Articles View ===== */
.sources-view,
.articles-view,
.article-detail {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-primary);
}

.sources-search,
.articles-search {
  padding: 12px 16px;
}

.sources-search input,
.articles-search input {
  width: 100%;
  padding: 10px 14px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 14px;
}

.sources-search input::placeholder,
.articles-search input::placeholder {
  color: var(--text-disabled);
}

.sources-search input:focus,
.articles-search input:focus {
  outline: none;
  border-color: var(--accent);
}

.sources-list,
.articles-list {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px 16px;
}

.sources-empty,
.articles-empty {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-secondary);
}

/* ===== Articles Filter ===== */
.articles-filter {
  display: flex;
  gap: 8px;
  padding: 0 16px 12px;
}

.articles-filter button {
  padding: 6px 14px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  color: var(--text-secondary);
  font-size: 13px;
  cursor: pointer;
}

.articles-filter button.active {
  background: var(--accent);
  border-color: var(--accent);
  color: white;
}

.articles-filter button:hover:not(.active) {
  background: var(--bg-hover);
}

/* ===== Source Form ===== */
.source-form-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.source-form {
  background: var(--bg-primary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 24px;
  width: 90%;
  max-width: 400px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.12);
}

.source-form h2 {
  margin: 0 0 20px;
  font-size: 18px;
  color: var(--text-primary);
}

.form-field {
  margin-bottom: 16px;
}

.form-field label {
  display: block;
  margin-bottom: 6px;
  font-size: 13px;
  color: var(--text-secondary);
}

.form-field input[type="text"],
.form-field input[type="url"],
.form-field select {
  width: 100%;
  padding: 10px 12px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-size: 14px;
}

.form-field input:focus,
.form-field select:focus {
  outline: none;
  border-color: var(--accent);
}

.form-actions {
  display: flex;
  justify-content: space-between;
  margin-top: 24px;
}

.form-actions-right {
  display: flex;
  gap: 8px;
}

.form-actions button {
  padding: 10px 16px;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
}

.form-actions button.primary {
  background: var(--accent);
  color: white;
}

.form-actions button.primary:hover {
  background: var(--accent-hover);
}

.form-actions button.danger {
  background: var(--error);
  color: white;
}

.form-actions button:not(.primary):not(.danger) {
  background: var(--bg-surface);
  border: 1px solid var(--border);
  color: var(--text-primary);
}

.form-actions button:not(.primary):not(.danger):hover {
  background: var(--bg-hover);
}
```

**Step 2: Verify build succeeds**

Run: `npm run build`
Expected: Build completes without errors

**Step 3: Commit**

```bash
git add sidepanel.css
git commit -m "style: update views and forms for light theme"
```

---

## Task 13: Remove Dark Mode Styles

**Files:**
- Modify: `sidepanel.css`

**Step 1: Remove all dark mode CSS rules**

Delete all CSS blocks that start with `.chat-container.dark-mode` (approximately lines 424-502 in original file). These are no longer needed.

Also remove any remaining references to dark theme colors.

**Step 2: Verify build succeeds**

Run: `npm run build`
Expected: Build completes without errors

**Step 3: Commit**

```bash
git add sidepanel.css
git commit -m "chore: remove dark mode styles"
```

---

## Task 14: Update Typing Indicator

**Files:**
- Modify: `sidepanel.css`

**Step 1: Update typing indicator styles**

Replace the `.typing-indicator` styles:

```css
.typing-indicator {
  display: flex;
  gap: 4px;
  padding: 4px 0;
}

.typing-indicator span {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-disabled);
  animation: typing 1.4s infinite ease-in-out;
}

.typing-indicator span:nth-child(1) {
  animation-delay: 0s;
}

.typing-indicator span:nth-child(2) {
  animation-delay: 0.2s;
}

.typing-indicator span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing {
  0%, 60%, 100% {
    transform: translateY(0);
    opacity: 0.4;
  }
  30% {
    transform: translateY(-4px);
    opacity: 1;
  }
}
```

**Step 2: Verify build succeeds**

Run: `npm run build`
Expected: Build completes without errors

**Step 3: Commit**

```bash
git add sidepanel.css
git commit -m "style: update typing indicator"
```

---

## Task 15: Final Cleanup and Testing

**Files:**
- Modify: `sidepanel.tsx`

**Step 1: Remove the toggleBrowserTools warning state**

Remove `showBrowserToolsWarning` state and related JSX as the new toggle design makes it unnecessary.

Find and remove:
- `const [showBrowserToolsWarning, setShowBrowserToolsWarning] = useState(false);`
- The warning banner JSX block
- Any references to `setShowBrowserToolsWarning`

**Step 2: Remove old settings-icon-btn usages**

Search for `settings-icon-btn` class usages and ensure they're replaced with `icon-btn`.

**Step 3: Full build and test**

Run: `npm run build`
Expected: Build completes without errors

**Step 4: Load extension and verify**

1. Open Chrome → `chrome://extensions/`
2. Click reload on the Atlas extension
3. Open sidepanel and verify:
   - Header shows "Atlas" + settings gear
   - Tabs work (Chat/Sources/Articles)
   - Messages display correctly
   - Input area has toggle + input + new chat button
   - Light theme throughout

**Step 5: Final commit**

```bash
git add sidepanel.tsx sidepanel.css
git commit -m "chore: final cleanup and polish"
```

---

## Summary

After completing all tasks, the extension will have:

1. Clean minimal design with light theme
2. Tab-based navigation (Chat/Sources/Articles)
3. Labeled Browser Tools toggle
4. Simplified header with single settings button
5. Updated message bubbles and input area
6. Consistent visual language using CSS variables

Total estimated time: 45-60 minutes
