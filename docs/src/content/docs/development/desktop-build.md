---
title: Building the Desktop App
description: How to build and customize the native desktop application using Tauri.
---

Budgetzilla uses [Tauri](https://tauri.app/) to provide a native desktop experience across macOS, Windows, and Linux.

## Prerequisites

To build the desktop application, you need the following installed on your system:

- **Rust** — [Install via rustup](https://rustup.rs/)
- **Node.js 18+** — [Download from nodejs.org](https://nodejs.org/)
- **Platform Dependencies**:
  - **macOS**: Xcode Command Line Tools (`xcode-select --install`)
  - **Windows**: [Microsoft Visual Studio C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) and WebView2
  - **Linux**: See [Tauri Linux prerequisites](https://tauri.app/v1/guides/getting-started/prerequisites/#linux)

## Development

Run the application in development mode with hot-reloading:

```bash
cd webapp
npm run tauri:dev
```

This starts the Vite development server and opens the Tauri window.

## Production Build

### macOS

```bash
cd webapp
npm run tauri:build
```

Build artifacts will be in `src-tauri/target/release/bundle/macos/`.

### Windows

You can use the provided batch script to build on Windows (handling specific MSVC environment issues):

```bash
cd webapp
.\build_tauri.bat
```

Build artifacts will be in `src-tauri/target/release/bundle/msi/` and `bundle/setup.exe`.

## Configuration

The desktop app is configured in `webapp/src-tauri/tauri.conf.json`.

### Metadata

| Field | Description |
|-------|-------------|
| `productName` | The display name of the application (set to `Budgetzilla`) |
| `version` | App version string |
| `identifier` | Unique bundle identifier (e.g., `com.budgetzilla.app`) |

### Window Configuration

| Field | Description |
|-------|-------------|
| `title` | Default window title |
| `width` / `height` | Initial window dimensions |
| `resizable` | Whether the user can resize the window |

## App Icons

Icons are managed via the Tauri CLI. To update the application icons from a source image:

1. Place your source icon (1024x1024 PNG recommended) in `webapp/Budgetzilla.jpg` (or any path)
2. Run the icon generation command:
   ```bash
   cd webapp
   npx tauri icon ./Budgetzilla.jpg
   ```

This automatically generates all required formats for all platforms in `src-tauri/icons/`.

## Troubleshooting

### Windows Build Failures

If you encounter errors related to `c2.dll` or resource exhaustion:

1. Use `build_tauri.bat` which forces x86 host tools.
2. Ensure you have at least 8GB of RAM available.
3. Check that `VsDevCmd.bat` path in the script matches your Visual Studio installation.

### Rust Version Issues

Ensure your Rust toolchain is up to date:

```bash
rustup update
```

### WebView2 Problems (Windows)

The application requires the WebView2 runtime. It is pre-installed on Windows 10/11, but can be downloaded [here](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) if missing.
