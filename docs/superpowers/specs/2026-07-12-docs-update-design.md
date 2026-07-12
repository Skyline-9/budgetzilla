# Design Spec: Docs Website Content Sync

This document specifies the updates required to sync the Budgetzilla documentation site with actual application behavior and consolidated page structure.

## 1. Goal

Address discrepancies in user-facing documentation for keyboard shortcuts, transaction amount entry, and settings page navigation.

## 2. Targeted Files & Modifications

### A. Keyboard Shortcuts (`docs/src/content/docs/reference/keyboard-shortcuts.md`)

Align documented shortcuts with the actual key listeners in `AppShell.tsx` and in-app shortcuts dialog in `Sidebar.tsx`.

* **Action:** Remove the "Navigation" shortcuts table (`G` then `D`/`T`/`C`/`S`) and the "Transaction List" table (`J`, `K`).
* **Action:** Add the "Transactions" and "Categories" shortcut lists matching the in-app shortcuts dialog.

### B. Transactions (`docs/src/content/docs/features/transactions.md`)

Clarify that negative sign entry is not required for expenses, as Budgetzilla auto-detects and signs amounts based on the category's type.

* **Action:** Update the quick add field explanation for "Amount".
* **Action:** Update the transaction fields table description for "Amount".

### C. Google Drive Sync (`docs/src/content/docs/features/google-drive-sync.md`)

Update navigation steps to reflect that settings are now organized under the "Data & Sync" tab.

* **Action:** Update setup and disconnection steps to reference `Settings > Data & Sync` tab instead of `Settings > Cloud Sync`.

## 3. Verification Criteria

1. Verify that `npm run build` runs successfully on the `docs` website with no broken markdown links or frontmatter errors.
2. Confirm all updated pages are rendered correctly.
