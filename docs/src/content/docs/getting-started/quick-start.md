---
title: Quick Start
description: Get Budget running in minutes.
---

Choose your preferred way to run Budget:

## Option 1: macOS App (Recommended)

The easiest way to use Budget on macOS:

```bash
git clone https://github.com/your-username/budget.git
cd budget
./build_mac_app.sh
open dist/Budget.app
```

**Requirements:**
- macOS 12 or later
- Xcode Command Line Tools: `xcode-select --install`
- Node.js 18+

## Option 2: Browser (Development)

Run Budget in your browser for development or if you're not on macOS:

```bash
git clone https://github.com/your-username/budget.git
cd budget/webapp
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

**Browser Requirements:**
- Chrome, Edge, or Firefox (Safari has limited OPFS support)
- Not in private/incognito mode (storage won't persist)

## First Steps

Once Budget is running:

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

## Next Steps

- [Full installation guide](/getting-started/installation/)
- [Understanding transactions](/features/transactions/)
- [Setting up Google Drive sync](/features/google-drive-sync/)
