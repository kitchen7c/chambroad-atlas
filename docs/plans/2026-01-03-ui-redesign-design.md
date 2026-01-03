# Atlas Chrome Extension UI Redesign

## Overview

Redesign the Atlas Chrome extension UI for knowledge workers who need clear, intuitive browser automation without technical complexity.

## Design Principles

- **Clean Minimal**: Linear/Notion-inspired with whitespace, subtle borders, restrained colors
- **Neutral Monochrome**: Grays and blacks with single blue accent
- **Clear Navigation**: Tab-based navigation replacing cryptic icon buttons

## Target User

Knowledge workers - non-technical professionals who need easy browser automation.

---

## Layout Structure

### Header
```
┌─────────────────────────────────────┐
│  Atlas                         [⚙] │
└─────────────────────────────────────┘
```
- "Atlas" wordmark, left-aligned
- Single settings gear icon, right-aligned
- No model name in header

### Tab Navigation
```
┌──────────────────────────────────────┐
│  Chat        Sources      Articles   │
│  ────                                │
└──────────────────────────────────────┘
```
- Three text tabs, no icons
- Active tab: black text + 2px blue underline
- Inactive tabs: muted gray text
- Tab bar background: `#fafafa`

### Chat View

**Empty State:**
- Centered welcome text: "Welcome to Atlas"
- Subtitle: "Ask anything or enable Browser Tools to automate your browser."
- Optional CTA button for Browser Tools

**Message Bubbles:**
- User: Right-aligned, `#f3f4f6` background
- Assistant: Left-aligned, white background with `#e5e7eb` border
- Both: 12px rounded corners, max-width 85%
- No avatars

### Input Area
```
┌─────────────────────────────────────┐
│  Browser Tools  ┌────┐              │
│  ○ Off          │ On │              │
├─────────────────────────────────────┤
│  ┌─────────────────────────────┐    │
│  │ Ask Atlas anything...       │ ↑  │
│  └─────────────────────────────┘    │
│                          New Chat ↻ │
└─────────────────────────────────────┘
```
- Browser Tools: Labeled toggle (Off/On segmented control)
- Input: Expandable, 8px radius, blue focus ring
- Send: Arrow icon, blue when active
- New Chat: Text link with refresh icon, right-aligned below input

### Sources View
```
┌─────────────────────────────────────┐
│  🔍 Search sources...               │
├─────────────────────────────────────┤
│  ┌─────────────────────────────┐    │
│  │ Source Name                 ⋯   │
│  │ RSS · 12 unread                 │
│  └─────────────────────────────┘    │
│              [+ Add Source]         │
└─────────────────────────────────────┘
```
- Search bar at top
- Source cards with name, type, unread count
- Overflow menu (⋯) for edit/delete
- Add Source button at bottom

### Articles View
```
┌─────────────────────────────────────┐
│  All    Unread    Favorites         │
│  ───                                │
├─────────────────────────────────────┤
│  ┌─────────────────────────────┐    │
│  │ Article Title               ●   │
│  │ Source · 2h ago                 │
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
```
- Filter pills: All / Unread / Favorites
- Article cards with title, source, time
- Blue dot for unread, star for favorites

---

## Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| `--text-primary` | `#111827` | Main text |
| `--text-secondary` | `#6b7280` | Muted text |
| `--text-disabled` | `#9ca3af` | Hints, placeholders |
| `--bg-primary` | `#ffffff` | Main background |
| `--bg-surface` | `#f9fafb` | Inputs, cards |
| `--bg-hover` | `#f3f4f6` | Hover states |
| `--border` | `#e5e7eb` | Borders |
| `--accent` | `#2563eb` | Links, active states |
| `--accent-hover` | `#1d4ed8` | Accent hover |
| `--success` | `#22c55e` | Success states |
| `--warning` | `#f59e0b` | Warnings |
| `--error` | `#ef4444` | Errors |

---

## Typography

| Element | Size | Weight |
|---------|------|--------|
| Header title | 16px | 600 |
| Tab labels | 13px | 500 |
| Body text | 14px | 400 |
| Small/meta | 12px | 400 |
| Input text | 15px | 400 |

Font stack: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`

---

## Spacing Scale

- `4px` - tight spacing
- `8px` - default gap
- `12px` - padding small
- `16px` - padding standard
- `24px` - section spacing
- `32px` - large spacing

---

## Interaction States

- **Hover**: Slight background darken or border highlight
- **Focus**: Blue outline `box-shadow: 0 0 0 2px rgba(37,99,235,0.2)`
- **Active**: Subtle scale or darken
- **Disabled**: 50% opacity

---

## Components to Update

1. **Header** (`sidepanel.tsx` lines 1299-1341)
   - Remove model display from header
   - Replace icon buttons with single settings gear

2. **Tab Navigation** (new component)
   - Create TabBar component
   - Handle Chat/Sources/Articles switching

3. **Message Bubbles** (`sidepanel.css` lines 140-192)
   - Update colors to light theme
   - Remove dark backgrounds

4. **Input Area** (`sidepanel.tsx` lines 1392-1418, `sidepanel.css` lines 331-422)
   - Add Browser Tools labeled toggle
   - Redesign input field styling
   - Add New Chat text link

5. **Welcome State** (`sidepanel.tsx` lines 1359-1364)
   - Update copy and add CTA button

6. **Source/Article Cards** (`sidepanel.css` lines 610-713, 851-902)
   - Lighter styling, remove dark mode specifics

---

## Files to Modify

- `sidepanel.tsx` - Main chat component restructure
- `sidepanel.css` - Complete style overhaul
- `src/components/SourcesView.tsx` - Update card styling
- `src/components/ArticlesView.tsx` - Update card styling
- `src/components/SourceCard.tsx` - Light theme styling
- `src/components/ArticleCard.tsx` - Light theme styling

## New Components

- `src/components/TabBar.tsx` - Tab navigation component
- `src/components/Toggle.tsx` - Browser Tools toggle component
