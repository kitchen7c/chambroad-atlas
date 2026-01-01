# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chambroad Atlas is an AI-powered browser automation tool with two deployment modes:
1. **Chrome Extension** - Sidebar chat UI that integrates with the browser
2. **Electron Desktop App** - Standalone browser application with built-in Atlas capabilities

Both modes use Google Gemini for AI and support two automation approaches:
- **Browser Tools Mode**: Uses Gemini 2.5 Computer Use for visual browser automation (screenshots, clicks, typing)
- **Tool Router Mode**: Uses Composio for API-based integrations (Gmail, Slack, GitHub, 500+ apps)

## Build Commands

### Chrome Extension
```bash
npm install          # Install dependencies
npm run build        # Build extension to dist/
npm run dev          # Development mode with hot reload
```

Load the extension: Chrome → `chrome://extensions/` → Enable Developer mode → Load unpacked → Select `dist/`

### Electron App
```bash
cd electron-browser
npm install
npm run build        # Build for production (outputs to dist/)
npm run start        # Run built app
npm run dev          # Development mode with hot reload
npm run package      # Create distributable package (outputs to release/)
```

## Architecture

### Chrome Extension Structure (root)
- `sidepanel.tsx` - Main React chat interface, handles messaging, tool execution, and MCP client connections
- `background.ts` - Service worker for browser memory, tab tracking, and message routing
- `content.ts` - Content script for DOM interaction, page context extraction, and visual feedback (click indicators)
- `settings.tsx` - Settings UI for API key configuration
- `types.ts` - Shared TypeScript interfaces and Zod validation schemas
- `manifest.json` - Extension configuration (Manifest V3)
- `vite.config.ts` - Vite build config with multi-entry setup for extension files

### Electron App Structure (`electron-browser/`)

**Main Process** (`src/main/`):
- `index.ts` - App entry point, window creation, lifecycle management
- `window-manager.ts` - BrowserWindow management
- `browser-manager.ts` - BrowserView for web browsing
- `ipc-handlers.ts` - IPC communication handlers
- `computer-use-service.ts` - Gemini Computer Use integration

**Preload** (`src/preload/`):
- `index.ts` - Exposes electron APIs to renderer via contextBridge

**Renderer** (`src/renderer/`):
- `App.tsx` - Main React app with split-pane layout (chat + browser)
- `components/ChatInterface.tsx` - Chat UI and message handling
- `components/NavBar.tsx` - Navigation controls
- `components/Settings.tsx` - Settings panel
- `services/` - AI services (Gemini, Computer Use, Tool Router)

### Key Integrations

**AI SDK (Vercel)**: Uses `ai` package with `@ai-sdk/google` for Gemini integration. The `experimental_createMCPClient` function connects to Composio's MCP servers for tool routing.

**Composio**: Tool routing for 500+ app integrations. Creates MCP sessions via `https://mcp.composio.dev/*/session` endpoint. Session URLs are used with AI SDK's MCP client.

**Gemini Models**:
- Standard: `gemini-2.0-flash-exp` (default)
- Computer Use: `gemini-2.5-computer-use-preview` (requires special access)

### IPC Communication Patterns

Extension: Uses `chrome.runtime.onMessage` for background ↔ content script ↔ sidebar communication.

Electron: Uses `ipcMain`/`ipcRenderer` with handlers defined in `ipc-handlers.ts` and exposed via preload script.

## Tech Stack

- TypeScript, React 18, Vite 5
- AI SDK (Vercel) for LLM integration
- MCP (Model Context Protocol) for tool integration
- Zod for runtime validation
- Electron 28 (desktop app only)
- Chrome Extension Manifest V3
