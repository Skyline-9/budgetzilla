---
title: Quick Start
description: Get Budgetzilla running in minutes.
---

Choose your preferred way to run Budgetzilla:

## Option 1: Desktop App (Tauri)

The recommended way to use Budgetzilla:

```bash
git clone https://github.com/Skyline-9/budgetzilla.git
cd budget/webapp
npm install
npm run tauri:dev
```

**Requirements:**
- **Rust** (install via [rustup.rs](https://rustup.rs/))
- macOS 12+ or Windows 10/11

## Option 2: Browser (Development)

Run Budgetzilla in your browser for development or if you're not on macOS:

```bash
git clone https://github.com/Skyline-9/budgetzilla.git
cd budget/webapp
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

**Browser Requirements:**
- Chrome, Edge, or Firefox (Safari has limited OPFS support)
- Not in private/incognito mode (storage won't persist)

## First Steps

Once Budgetzilla is running:

1. **Add your first transaction** — Press `N` or click the + button
2. **Create categories** — Go to Categories page to organize your spending
3. **Set up budgets** — Define monthly limits for categories
4. **Explore the dashboard** — See your spending visualized

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd/Ctrl + K` | Global search |
| `N` | Add new transaction |
| `Esc` | Close dialogs |

## 🌐 Optional: Ollama CORS Setup

If you use the hosted version of Budgetzilla (or any non-localhost URL) and want to use **Ollama** for AI scanning, you must configure CORS:

**macOS:**
```bash
OLLAMA_ORIGINS="https://budgetzilla-app.vercel.app,http://localhost:5173" ollama serve
```

**Windows:**
1. Set User Environment Variable `OLLAMA_ORIGINS` to `https://budgetzilla-app.vercel.app,http://localhost:5173`.
2. Restart Ollama app.

For more details, see the [Local AI Guide](/features/local-ai/).
