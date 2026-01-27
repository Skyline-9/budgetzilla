<p align="center">
  <img src="webapp/public/favicon/favicon-256.png" alt="Budget" width="120" height="120" />
</p>

<h1 align="center">Budget</h1>

<p align="center">
  <strong>Local-first budgeting that just works.</strong><br/>
  React frontend • SQLite WASM • Native macOS app<br/>
  All your data stays local in your browser with optional Google Drive sync.
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-features">Features</a> •
  <a href="#-building-the-macos-app">Build macOS App</a> •
  <a href="#-development">Development</a>
</p>

---

## 🚀 Quick Start

### Run the macOS App (Easiest)

```bash
./build_mac_app.sh
open dist/Budget.app
```

**First time?** The script auto-builds everything. Just make sure you have:
- Xcode Command Line Tools: `xcode-select --install`
- Node.js 18+

### Or Run in Browser (Development)

```bash
cd webapp
npm install
npm run dev
# Open http://localhost:5173
```

---

## ✨ Features

- 💰 **Transaction management** with categories and budgets
- 📊 **Visual dashboard** with spending trends and charts
- 🔍 **Fast search** (Cmd+K) across all transactions
- ⌨️ **Keyboard shortcuts** (N to add transaction)
- 💾 **Local SQLite storage** in your browser (OPFS)
- ☁️ **Optional Google Drive sync** for backup
- 🎨 **Modern UI** with dark mode and smooth animations
- 🚀 **Zero backend** - runs entirely in your browser

---

## 📁 Project Structure

```
budget/
├── webapp/           React + TypeScript + SQLite WASM
│   ├── src/
│   │   ├── api/      API client layer
│   │   ├── db/       SQLite database operations
│   │   ├── services/ Google Drive sync, import/export
│   │   └── components/  UI components
├── macos-app/        Swift wrapper + Rust build tool
│   ├── build_tool/   Fast incremental build system
│   └── Sources/      Native macOS window & menus
└── dist/             Built .app bundles
```

---

## 💻 Development

### Quick Webapp Iteration

```bash
cd webapp
npm run dev  # Local SQLite mode (default)
```

Open `http://localhost:5173` — hot reload enabled.

### Building Tauri Desktop App

**Prerequisites:**
- [Rust](https://www.rust-lang.org/tools/install) (install via `rustup`)
- macOS: Xcode Command Line Tools (`xcode-select --install`)
- Windows: Microsoft Visual Studio C++ Build Tools, WebView2
- Linux: `webkit2gtk`, `libappindicator3`, `librsvg2`

**Development:**
```bash
cd webapp
npm run tauri:dev
```

**Production Build:**
```bash
cd webapp
npm run tauri:build
```

Build artifacts output to `webapp/src-tauri/target/release/bundle/` (`.app`, `.dmg`, `.exe`, `.msi`, `.deb`, `.AppImage`).

### API Modes

```bash
npm run dev          # Local mode - SQLite WASM (default)
npm run dev:mock     # Mock mode - in-memory mock data
```

### Fast macOS App Iteration

```bash
DEV_MODE=1 ./build_mac_app.sh  # Rebuilds frontend only
open dist/Budget.app           # Manually restart
```

### Keyboard Shortcuts

- **Cmd/Ctrl+K** — Global search
- **N** — Add transaction
- **Esc** — Close dialogs

---

## 📊 Data Storage

Data is stored locally in your browser using SQLite WASM with OPFS persistence:

- **Transactions** — Your spending and income records
- **Categories** — Expense and income categorization
- **Budgets** — Monthly budget allocations

### Export Options

- CSV export for individual data types
- Excel (XLSX) workbook with all data
- Google Drive sync for cloud backup

### Import Options

- Cashew CSV import (popular budgeting app)
- Legacy CSV migration from previous backend versions

---

## 🛠 Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Radix UI, TanStack Query
- **Database:** SQLite WASM (sql.js) with OPFS persistence
- **Sync:** Google Drive API via Google Identity Services
- **Build:** Rust (orchestrator), SwiftPM
- **macOS App:** Swift, WKWebView with local HTTP server

---

## 🐛 Troubleshooting

**App icon doesn't show:**
```bash
killall Finder && killall Dock
```

**Build fails:**
```bash
CLEAN=1 VERBOSE=1 ./build_mac_app.sh
```

**Need Rust toolchain:**
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

**Browser storage issues:**
- Check that your browser supports OPFS (Chrome, Edge, Firefox)
- Ensure the site is not in private/incognito mode
- Check storage quota in browser settings

---

## 📝 License

MIT

---

<p align="center">
  Made with ❤️ for local-first budgeting
</p>
