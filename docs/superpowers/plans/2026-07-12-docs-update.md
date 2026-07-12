# Documentation Content Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sync outdated user-facing documentation content on keyboard shortcuts, transaction quick-add signing behavior, and Settings navigation with the actual application implementation.

**Architecture:** Modify the Starlight documentation markdown files in-place and run the Astro build script to ensure compilation checks pass.

**Tech Stack:** Astro, Starlight, Git

## Global Constraints

- User-facing documentation must align precisely with the in-app UX.
- Frontmatter format must remain valid in all modified markdown files.
- The Astro build must compile successfully at the end of the changes.

---

### Task 1: Update Keyboard Shortcuts Reference

**Files:**
- Modify: `docs/src/content/docs/reference/keyboard-shortcuts.md`

**Interfaces:**
- Consumes: None
- Produces: Corrected shortcuts page in website output.

- [ ] **Step 1: Replace outdated shortcuts in keyboard-shortcuts.md**
  Open [keyboard-shortcuts.md](file:///Users/richardluo/Developer/budgetzilla/docs/src/content/docs/reference/keyboard-shortcuts.md) and replace the "Navigation" and "Transaction List" sections (lines 16-33) with the corrected "Transactions" and "Categories" sections.
  
  Target Content to replace:
  ```markdown
  ## Navigation

  | Shortcut | Action |
  |----------|--------|
  | `G` then `D` | Go to Dashboard |
  | `G` then `T` | Go to Transactions |
  | `G` then `C` | Go to Categories |
  | `G` then `S` | Go to Settings |

  ## Transaction List

  | Shortcut | Action |
  |----------|--------|
  | `J` | Move to next transaction |
  | `K` | Move to previous transaction |
  | `Enter` | Open selected transaction |
  | `Delete` | Delete selected transaction |
  ```

  Replacement Content:
  ```markdown
  ## Transactions

  | Shortcut | Action |
  |----------|--------|
  | `Enter` | Submit Quick Add (in quick add form) |
  | `Esc` | Clear Quick Add |
  | `Enter` / `Space` | Open selected transaction from table |

  ## Categories

  | Shortcut | Action |
  |----------|--------|
  | `↑` / `↓` | Move focus between rows |
  | `Enter` | Select focused row |
  | `Space` | Toggle selection of focused row |
  | `Shift + Click` | Range select rows |
  | `Cmd/Ctrl + Click` | Toggle selection (mouse) |
  ```

- [ ] **Step 2: Verify changes using git diff**
  Run: `git diff docs/src/content/docs/reference/keyboard-shortcuts.md`
  Expected: Clean diff showing the replaced sections.

- [ ] **Step 3: Commit the changes**
  Run: `git add docs/src/content/docs/reference/keyboard-shortcuts.md && git commit -m "docs: align keyboard shortcuts with in-app dialog"`

---

### Task 2: Clarify Transaction Amount Entry and Sign Auto-Detection

**Files:**
- Modify: `docs/src/content/docs/features/transactions.md`

**Interfaces:**
- Consumes: None
- Produces: Corrected transactions guide in website output.

- [ ] **Step 1: Replace outdated amount entry instructions in transactions.md**
  Open [transactions.md](file:///Users/richardluo/Developer/budgetzilla/docs/src/content/docs/features/transactions.md) and replace the Amount descriptions on lines 14 and 27.

  Target Content 1 to replace (around line 14):
  ```markdown
  - **Amount** — The transaction amount (positive for income, negative for expenses)
  ```

  Replacement Content 1:
  ```markdown
  - **Amount** — The transaction amount. You can enter this as a positive number; Budgetzilla will automatically sign it as negative for expense categories, or positive for income categories.
  ```

  Target Content 2 to replace (around line 27):
  ```markdown
  | Amount | The monetary value (positive = income, negative = expense) |
  ```

  Replacement Content 2:
  ```markdown
  | Amount | The monetary value (automatically signed based on the category type: negative for expenses, positive for income) |
  ```

- [ ] **Step 2: Verify changes using git diff**
  Run: `git diff docs/src/content/docs/features/transactions.md`
  Expected: Diff shows updated amount entry descriptions.

- [ ] **Step 3: Commit the changes**
  Run: `git add docs/src/content/docs/features/transactions.md && git commit -m "docs: clarify transaction amount auto-signing behavior"`

---

### Task 3: Update Google Drive Sync settings path

**Files:**
- Modify: `docs/src/content/docs/features/google-drive-sync.md`

**Interfaces:**
- Consumes: None
- Produces: Corrected sync setup/disconnect instructions.

- [ ] **Step 1: Replace outdated settings paths in google-drive-sync.md**
  Open [google-drive-sync.md](file:///Users/richardluo/Developer/budgetzilla/docs/src/content/docs/features/google-drive-sync.md) and replace `Settings > Cloud Sync` references on lines 17 and 64.

  Target Content 1 to replace (around line 17):
  ```markdown
  1. Go to **Settings > Cloud Sync**
  ```

  Replacement Content 1:
  ```markdown
  1. Go to the **Data & Sync** tab in **Settings**
  ```

  Target Content 2 to replace (around line 64):
  ```markdown
  1. Go to **Settings > Cloud Sync**
  ```

  Replacement Content 2:
  ```markdown
  1. Go to the **Data & Sync** tab in **Settings**
  ```

- [ ] **Step 2: Verify changes using git diff**
  Run: `git diff docs/src/content/docs/features/google-drive-sync.md`
  Expected: Diff shows references updated to the Data & Sync settings tab.

- [ ] **Step 3: Commit the changes**
  Run: `git add docs/src/content/docs/features/google-drive-sync.md && git commit -m "docs: update settings path for Google Drive Sync"`

---

### Task 4: Verify Compilation & Build

**Files:**
- None

- [ ] **Step 1: Run production build**
  Run: `npm run build` in `docs` directory.
  Expected: Successful compilation, sitemap generated, 17 pages built successfully.
