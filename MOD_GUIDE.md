# Mod / Personal Fork Guide

This workspace is based on an existing Electron app.

## What you can (and cannot) remove

- This project is licensed under MIT. That means you **must keep** the upstream license text and copyright notice in `LICENSE` in any redistributed copies.
- You *can* remove optional metadata and links (README, `package.json` fields, update/publish config, etc.).
- If you want the codebase to be **100% yours**, you need to **rewrite/replace** all upstream source files (clean-room style) so that no upstream code remains.

## Current architecture (where code lives)

- `electron/` — main process + preload
  - `electron/main.ts` — creates the BrowserWindow and registers IPC handlers
  - `electron/preload.ts` — exposes `window.unreal.*` API to the renderer
  - `electron/ipc/*.ts` — IPC modules (each module registers handlers)
  - `electron/services/*` — main-process services/helpers

- `src/` — renderer (React)
  - `src/App.tsx`, `src/main.tsx` — entry points
  - `src/pages/*` — pages (Settings, Projects, Marketplace, etc.)
  - `src/components/*` — UI components
  - `src/context/*` — React contexts
  - `src/hooks/*` — hooks
  - `src/utils/*` — shared utilities

## How to add only your own modules (recommended pattern)

### 1) Create a new IPC module (main process)

- Add a new file under `electron/ipc/your-module.ts`.
- Export a `registerYourModuleHandlers(...)` function that calls `ipcMain.handle(...)`.
- Register it from `electron/main.ts` next to other `register*Handlers()` calls.

### 2) Expose a minimal API to the renderer

- Add only the new API surface you need to `electron/preload.ts` under `window.unreal`.
- Update typings in `src/types.d.ts` so the renderer has correct TypeScript types.

### 3) Keep your renderer code separated

- Put your new UI/logic under `src/pages/` or create a dedicated folder like `src/mod/` and keep your code there.
- Avoid editing upstream files when possible; prefer:
  - composing existing components
  - adding new pages/components
  - adding new IPC handlers

## If your goal is a 100% original app

Practical checklist:

- Create a brand-new repository/workspace.
- Recreate features from scratch without copying upstream code.
- Only reuse *ideas*, not code.
- Then you can choose your own license and metadata.

(If you want, tell me which path you want: **fork** or **full rewrite**, and what your new app name/appId should be — I can help structure the repo accordingly.)
