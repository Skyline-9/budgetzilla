# Tauri Cross-Platform Build Guide

## Prerequisites

- **Node.js** 18+ and npm
- **Rust** 1.77.2+ (install via [rustup](https://rustup.rs/))
- Platform-specific requirements below

### macOS
- Xcode Command Line Tools: `xcode-select --install`

### Windows
- [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with C++ workload
- WebView2 (included in Windows 10/11)

### Linux
```bash
# Ubuntu/Debian
sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev

# Fedora
sudo dnf install webkit2gtk4.1-devel openssl-devel curl wget file \
  libxdo-devel libappindicator-gtk3-devel librsvg2-devel

# Arch
sudo pacman -S webkit2gtk-4.1 base-devel curl wget file openssl \
  appmenu-gtk-module libappindicator-gtk3 librsvg
```

## Development

```bash
cd webapp

# Install dependencies
npm install

# Start dev mode (hot-reload)
npm run tauri:dev
```

## Production Build

```bash
cd webapp

# Build for current platform
npm run tauri:build
```

### Build Outputs

| Platform | Location | Format |
|----------|----------|--------|
| macOS | `src-tauri/target/release/bundle/macos/` | `.app` bundle |
| macOS | `src-tauri/target/release/bundle/dmg/` | `.dmg` installer |
| Windows | `src-tauri/target/release/bundle/msi/` | `.msi` installer |
| Windows | `src-tauri/target/release/bundle/nsis/` | `.exe` installer |
| Linux | `src-tauri/target/release/bundle/deb/` | `.deb` package |
| Linux | `src-tauri/target/release/bundle/rpm/` | `.rpm` package |
| Linux | `src-tauri/target/release/bundle/appimage/` | `.AppImage` |

## CI/CD Cross-Platform Builds

Tauri apps must be built on the target platform. Use GitHub Actions with matrix builds:

```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    tags: ['v*']

jobs:
  release:
    permissions:
      contents: write
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: macos-latest
            args: --target aarch64-apple-darwin
          - platform: macos-latest
            args: --target x86_64-apple-darwin
          - platform: ubuntu-22.04
            args: ''
          - platform: windows-latest
            args: ''

    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install Rust stable
        uses: dtolnay/rust-action@stable

      - name: Install dependencies (Ubuntu)
        if: matrix.platform == 'ubuntu-22.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev build-essential \
            curl wget file libxdo-dev libssl-dev \
            libayatana-appindicator3-dev librsvg2-dev

      - name: Install frontend dependencies
        working-directory: webapp
        run: npm ci

      - name: Build Tauri app
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          projectPath: webapp
          tagName: v__VERSION__
          releaseName: 'Budgetzilla v__VERSION__'
          releaseBody: 'See the assets to download this version.'
          releaseDraft: true
          prerelease: false
          args: ${{ matrix.args }}
```

## Configuration

Main config file: `webapp/src-tauri/tauri.conf.json`

Key settings:
- `productName`: App display name
- `identifier`: Unique app ID (reverse domain)
- `bundle.icon`: App icons for all platforms
- `app.windows`: Window size and behavior

## Migrating from macOS Swift Wrapper

The old `macos-app/` directory with Swift wrapper is no longer needed. Tauri:
- Handles static file serving natively (no custom HTTP server)
- Uses system WebView (WebKit on macOS)
- Provides cross-platform support with one codebase
