# Architecture

Budgetzilla is a local-first budgeting app. The primary runtime is a React + SQLite
WASM webapp that stores all data locally in the browser (OPFS). The macOS app
is a thin Swift wrapper that serves the built webapp over a local HTTP server
and loads it in a WKWebView.

## High-level layout

- `webapp/`: React + TypeScript frontend and SQLite WASM storage
- `macos-app/`: Swift wrapper app and Rust build tool
- `build_mac_app.sh`: top-level build entrypoint for macOS app

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

### macOS app

1. `BackendManager` starts a local HTTP server on a random port.
2. The server serves the built webapp’s static assets from the app bundle and
   falls back to `index.html` for SPA routes.
3. `WKWebView` loads the local server URL.
4. The webapp uses `window.location.origin` as the API base in packaged builds,
   so the app can fetch relative to the local server.

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

- The macOS build is orchestrated by `build_mac_app.sh`, which runs the Rust
  build tool in `macos-app/build_tool/` and SwiftPM for the wrapper.
- The webapp build output is bundled into the macOS app and served by the local
  HTTP server at runtime.

## Key modules (webapp)

- `src/api/`: API client selection and request helpers.
- `src/db/`: SQLite schema and data access helpers.
- `src/components/`: reusable UI building blocks.
- `src/pages/`: page-level composition and data queries.
- `src/services/`: Drive sync, import/export, migrations.

## Non-goals

- No always-on backend server. All core app functionality runs fully local.
- Network access is optional and only used for Drive sync or external API mode.
