---
title: Building the macOS App
description: How to build and customize the native macOS application.
---

Budget includes a native macOS app that wraps the web application in a native window with system integration.

## Quick Build

```bash
./build_mac_app.sh
open dist/Budget.app
```

## Build System

The build system is written in Rust for speed and reliability. It:

1. **Builds the webapp** — Runs `npm run build` in the webapp directory
2. **Compiles Swift** — Builds the native macOS wrapper
3. **Generates icons** — Creates proper macOS icons from PNG
4. **Bundles everything** — Creates the final `.app` bundle

### Why Rust?

The build tool is in Rust because:

- **Fast** — Parallel builds, incremental compilation
- **Reliable** — Strong error handling
- **Cross-platform** — Works on any macOS system
- **No runtime** — Prebuilt binary included, no Rust installation needed

## Build Options

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CLEAN` | 0 | Full rebuild from scratch |
| `DEV_MODE` | 0 | Skip Swift build (frontend only) |
| `VERBOSE` | 0 | Show detailed output |
| `DRY_RUN` | 0 | Preview without building |
| `APP_NAME` | Budget | Custom app name |
| `APP_VERSION` | 1.0.0 | App version string |
| `CODESIGN_IDENTITY` | - | Code signing identity |

### Examples

```bash
# Full clean rebuild
CLEAN=1 ./build_mac_app.sh

# Fast frontend iteration
DEV_MODE=1 ./build_mac_app.sh

# Debug build issues
VERBOSE=1 ./build_mac_app.sh

# Custom branding
APP_NAME="MyBudget" APP_VERSION="2.0" ./build_mac_app.sh

# Signed for distribution
CODESIGN_IDENTITY="Developer ID Application: Name" ./build_mac_app.sh
```

## Architecture

### macOS App Structure

```
Budget.app/
├── Contents/
│   ├── Info.plist          # App metadata
│   ├── MacOS/
│   │   └── Budget          # Swift executable
│   ├── Resources/
│   │   ├── AppIcon.icns    # App icon
│   │   └── webapp/         # Built web files
│   └── _CodeSignature/     # (if signed)
```

### How It Works

1. Swift app starts a local HTTP server
2. WKWebView loads the webapp from the local server
3. Native menus and shortcuts integrated
4. Data stored in app container

### Swift Code Overview

```
macos-app/
├── Sources/MacWrapper/
│   ├── main.swift          # Entry point
│   ├── AppDelegate.swift   # App lifecycle
│   ├── WebViewController.swift  # WKWebView setup
│   └── BackendManager.swift     # Local server
└── Package.swift           # SwiftPM manifest
```

## Development Workflow

### UI Development

For rapid frontend iteration:

```bash
# Terminal 1: Run webapp dev server
cd webapp && npm run dev

# Terminal 2: Rebuild app (frontend only)
DEV_MODE=1 ./build_mac_app.sh
open dist/Budget.app
```

The app will load from the bundled files. For hot reload during development, you can modify the app to load from `localhost:5173` instead.

### Native Development

When modifying Swift code:

```bash
# Full rebuild needed for Swift changes
./build_mac_app.sh
```

## Customization

### App Icon

Replace the icon source:

```bash
# Your icon should be at least 1024x1024 PNG
cp your-icon.png webapp/public/favicon/favicon-256.png
./build_mac_app.sh
```

The build system automatically:
- Flattens transparency (required for macOS)
- Generates all required sizes
- Creates the `.icns` file

### App Name

```bash
APP_NAME="MyFinances" ./build_mac_app.sh
```

This updates:
- Bundle identifier
- Window title
- Menu bar name

## Code Signing

### For Personal Use

No signing needed — the app runs fine unsigned on your own Mac.

### For Distribution

```bash
# Sign with Developer ID
CODESIGN_IDENTITY="Developer ID Application: Your Name (TEAMID)" ./build_mac_app.sh

# Notarize for Gatekeeper
xcrun notarytool submit dist/Budget.app --apple-id "you@email.com" --team-id "TEAMID" --password "app-specific-password"
```

## Troubleshooting

### App Won't Open

```bash
# Check for signing issues
codesign -vvv dist/Budget.app

# Remove quarantine (development only)
xattr -cr dist/Budget.app
```

### Icon Not Updating

```bash
# Clear icon cache
killall Finder && killall Dock

# Or rebuild with clean
CLEAN=1 ./build_mac_app.sh
```

### Build Fails

```bash
# See what's happening
VERBOSE=1 CLEAN=1 ./build_mac_app.sh

# Check Xcode tools
xcode-select -p
```
