# Architecture

Budgetzilla is a local-first budgeting app. The primary runtime is a React + SQLite
WASM webapp that stores all data locally in the browser (OPFS). The desktop app
is built using Tauri, which provides a native Rust-based backend and a 
WebView-based frontend across macOS, Windows, and Linux.

## High-level layout

- `webapp/`: React + TypeScript frontend and SQLite WASM storage
- `webapp/src-tauri/`: Tauri configuration and Rust-based desktop backend
- `webapp/build_tauri.bat`: Build entrypoint for Windows Tauri app

## Runtime architecture

### Webapp (browser or WKWebView)

1. `webapp/src/main.tsx` bootstraps the React app.
2. Data access flows through the API client layer in `webapp/src/api/`.
3. In `local` mode, the API client calls into the SQLite WASM database layer
   under `webapp/src/db/`.
4. UI renders from page-level routes in `webapp/src/pages/` with shared
   components under `webapp/src/components/`.
5. Optional services (import/export, Google Drive sync) live in
   `webapp/src/services/`.

### Desktop app (Tauri)

1. Tauri starts a native process using Rust.
2. It uses the native WebView component (WKWebView on macOS, WebView2 on Windows).
3. The webapp is served via a custom protocol (`tauri://`) in production or 
   `localhost` in development.
4. Data access still flows through the same API layer, but Tauri provides 
   additional system capabilities (native menus, file system access).

## Data flow

- **Source of truth:** SQLite WASM database stored in OPFS within the browser.
- **Queries:** TanStack Query manages cache and request orchestration.
- **Domain types:** Shared type definitions live in `webapp/src/types/`.
- **Services:** Drive sync and import/export read/write through the local API
  client and database layer.

## API modes

`webapp/src/api/config.ts` defines an API mode that controls the client:

- `local` (default): uses SQLite WASM directly in the browser.
- `mock`: in-memory mock data for UI development.
- `real`: HTTP API mode for external backends (not included in this repo).

## Build and packaging

- Built using the Tauri CLI (`npm run tauri:build`).
- Compiles a Rust binary that bundles the built React webapp.
- Produces platform-specific installers (.app/dmg for macOS, .msi/exe for Windows).

## Key modules (webapp)

- `src/api/`: API client selection and request helpers.
- `src/db/`: SQLite schema and data access helpers.
- `src/components/`: reusable UI building blocks.
- `src/pages/`: page-level composition and data queries.
- `src/services/`: Drive sync, import/export, migrations.

## Non-goals

- No always-on backend server. All core app functionality runs fully local.
- Network access is optional and only used for Drive sync or external API mode.
