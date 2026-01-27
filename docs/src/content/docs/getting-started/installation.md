---
title: Installation
description: Detailed installation instructions for all platforms.
---

## Prerequisites

Before installing Budget, ensure you have:

- **Node.js 18+** — [Download from nodejs.org](https://nodejs.org/)
- **Git** — For cloning the repository

For the macOS app, you also need:
- **Xcode Command Line Tools** — `xcode-select --install`

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

## macOS App

### One-Command Build

```bash
./build_mac_app.sh
```

This creates `dist/Budget.app` with everything bundled inside.

### Build Options

```bash
# Full rebuild from scratch
CLEAN=1 ./build_mac_app.sh

# Fast frontend-only rebuild (for UI development)
DEV_MODE=1 ./build_mac_app.sh

# Show detailed build output
VERBOSE=1 ./build_mac_app.sh

# Preview what would be built without building
DRY_RUN=1 ./build_mac_app.sh

# Custom app name and version
APP_NAME="MyBudget" APP_VERSION="2.0" ./build_mac_app.sh

# Code signing for distribution
CODESIGN_IDENTITY="Developer ID Application: Your Name" ./build_mac_app.sh
```

### How the Build Works

The build system is written in Rust and optimized for speed:

1. **Parallel builds** — Frontend and Swift compile simultaneously
2. **Incremental** — Only rebuilds what changed
3. **Auto icon generation** — Creates proper macOS icon from PNG
4. **No Rust required** — Prebuilt universal binary included

## Data Storage

### Browser

Data is stored in your browser using OPFS (Origin Private File System). This means:

- Data persists across browser sessions
- Each browser has its own separate database
- Private/incognito mode won't persist data
- Clearing browser data will delete your budget data

### macOS App

The macOS app stores data in its application container:

```
~/Library/Containers/com.yourname.Budget/Data/
```

This location persists across app updates.

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
