# Repository Guidelines

## Project Structure & Module Organization

- **Chrome extension (root):** source lives at the repository root (no `src/`).
  - Entry points: `background.ts` (service worker), `content.ts` (content script), `sidepanel.tsx` (chat UI), `settings.tsx` (settings UI), `types.ts` (shared types/Zod).
  - UI assets: `sidepanel.html`, `settings.html`, `*.css`, `assets/`, `icons/`.
  - Build output: `dist/` (load this folder as an unpacked extension).
- **Electron app:** `electron-browser/` is a separate Vite + Electron project.
  - Main/IPC: `electron-browser/src/main/`
  - Preload: `electron-browser/src/preload/`
  - Renderer UI: `electron-browser/src/renderer/`

## Build, Test, and Development Commands

- `npm install`: install root dependencies.
- `npm run dev`: run Vite dev server for the extension UI; reload the extension after changes.
- `npm run build`: build the extension into `dist/` (do not edit `dist/` manually).
- `npm run preview`: preview the built extension bundle locally.
- `npx tsc -p tsconfig.json --noEmit`: TypeScript type-check (recommended before PRs).
- Electron app:
  - `cd electron-browser && npm install`
  - `npm run dev` (hot reload), `npm run build` (production build), `npm run start` (run built app), `npm run package` (create release artifacts).

## Coding Style & Naming Conventions

- TypeScript is `strict` (`tsconfig.json`); avoid `any` and keep types accurate.
- Match existing formatting: 2-space indentation, semicolons, single quotes.
- Naming: React components `PascalCase` (notably under `electron-browser/src/renderer/components/`); services/utilities typically `*-service.ts` / `*-manager.ts`.
- Imports: prefer local relative imports; `@` is aliased to the repo root in `vite.config.ts`.

## Testing Guidelines

- No automated test runner is currently configured.
- Minimum validation:
  - Run `npx tsc -p tsconfig.json --noEmit`.
  - Extension smoke test: `npm run build`, load `dist/` in `chrome://extensions/`, open the side panel, verify a basic chat flow.

## Commit & Pull Request Guidelines

- Use Conventional Commits (observed in history), e.g. `feat: ...`, `fix: ...`, `docs: ...`.
- PRs should include: summary, how to test (commands + reload steps), and screenshots for UI changes (side panel/settings).
- Never commit secrets: keep `.env` local, use `.env.example` as a template, and store API keys via the Settings UI where possible.
