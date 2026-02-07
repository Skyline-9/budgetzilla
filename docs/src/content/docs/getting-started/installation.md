---
title: Installation
description: Detailed installation instructions for all platforms.
---

## Prerequisites

Before installing Budget, ensure you have:

- **Node.js 18+** — [Download from nodejs.org](https://nodejs.org/)
- **Git** — For cloning the repository
- **Rust** — Required for the desktop app ([rustup.rs](https://rustup.rs/))

### Platform Specific Requirements

- **macOS**: Xcode Command Line Tools (`xcode-select --install`)
- **Windows**: [Microsoft Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) and WebView2
- **Linux**: Build essentials and WebKit2GTK (see [Tauri docs](https://tauri.app/v1/guides/getting-started/prerequisites/))

## Clone the Repository

```bash
git clone https://github.com/your-username/budget.git
cd budget
```

## Browser Version

### Install Dependencies

```bash
cd webapp
npm install
```

### Development Mode

```bash
npm run dev
```

This starts a development server at http://localhost:5173 with hot reload.

### Production Build

```bash
npm run build
npm run preview
```

The built files are in `webapp/dist/` and can be served by any static file server.

## Desktop App (Tauri)

### Development

```bash
cd webapp
npm run tauri:dev
```

This starts the Vite dev server and opens the native application window.

### Production Build

```bash
cd webapp
npm run tauri:build
```

Build artifacts are output to `src-tauri/target/release/bundle/`.

| Platform | Output Format |
|----------|---------------|
| **macOS** | `.app`, `.dmg` |
| **Windows** | `.msi`, `.exe` |
| **Linux** | `.deb`, `.AppImage` |

### How the Build Works

Budgetzilla uses Tauri to bridge the web frontend with a native Rust backend:

1. **Vite Build** — Compiles the React application into static assets.
2. **Rust Compilation** — Compiles the native backend and bundles the assets.
3. **Packaging** — Creates platform-specific installers and bundles.

## Data Storage

### Browser Mode

Data is stored using OPFS (Origin Private File System). This means:

- Data persists across browser sessions.
- Private/incognito mode won't persist data.
- Clearing browser data WILL delete your budget data.

### Desktop App Mode

The desktop app stores data in the standard system application data folder:

- **macOS**: `~/Library/Application Support/com.budgetzilla.app/`
- **Windows**: `%APPDATA%\com.budgetzilla.app\`
- **Linux**: `~/.local/share/com.budgetzilla.app/`

## Troubleshooting

### Browser Storage Issues

If data isn't persisting:

1. Ensure you're not in private/incognito mode
2. Check browser supports OPFS (Chrome, Edge, Firefox)
3. Check storage quota in browser settings

### macOS Build Issues

```bash
# Full verbose rebuild
CLEAN=1 VERBOSE=1 ./build_mac_app.sh
```

### App Icon Not Showing

```bash
killall Finder && killall Dock
```

### Need Rust Toolchain

Only needed if you want to modify the build system:

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```
