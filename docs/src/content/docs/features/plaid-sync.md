---
title: Bank Transaction Sync with Plaid
description: Connect your own Plaid account through the local Budgetzilla companion.
---

Budgetzilla can import bank transactions through Plaid using credentials from your own Plaid account. Plaid access is optional and requires the **Budgetzilla Plaid Companion** to run on the same computer as the app.

## What you need

- A Plaid account with a client ID and secret.
- The Budgetzilla Plaid Companion installed on the computer where you use Budgetzilla.
- A supported browser that allows the Budgetzilla site to connect to a local service, if you use the hosted web app.

## Configure the companion

1. Download the companion for your operating system from a Budgetzilla release.
2. Configure the companion with the exact origin of the app you use. For the hosted app, run `plaid-companion configure --environment sandbox --origin https://budgetzilla-app.vercel.app`. For desktop, use `plaid-companion configure --environment sandbox --origin tauri://localhost --origin http://tauri.localhost`.
3. Enter the client ID and secret from your Plaid account when prompted. The secret is entered locally and saved in your operating system's credential store. Use `--environment production` when you are ready to connect real accounts.
4. For hosted web, run `plaid-companion serve` and leave it running while you use Budgetzilla.

The companion prints a local port and a short-lived pairing code. In Budgetzilla, open **Settings > Data & Backup**, enter the companion address and code in the Plaid bank sync section, and choose **Pair companion**. Your browser may ask you to allow the Budgetzilla site to access the companion on your computer.

In the desktop app, the companion is launched by Budgetzilla. Configure your Plaid credentials once with the desktop origins above, then connect from Settings. The standalone companion download is also needed to enter credentials; the desktop app itself does not ask you to paste a Plaid secret.

## Connect and sync accounts

1. Choose **Connect bank** in the Plaid section of Settings.
2. Select an institution and accounts in Plaid Link.
3. Choose which accounts to import.
4. Budgetzilla imports the history you selected and assigns new transactions to **Uncategorized**.

Use **Sync** to request available changes. Budgetzilla also checks for updates when it opens. Pending transactions may later become posted, and banks may revise or remove transactions. Updates are not necessarily real time; availability depends on when Plaid receives data from your institution.

Budgetzilla keeps imported transactions in its local database. The companion keeps Plaid credentials, access tokens, and sync cursors on your computer; these are not stored in the web app, transaction database, exports, or Google Drive backup. Imported transaction data remains part of your Budgetzilla database and follows the app's existing backup behavior.

Each computer has its own companion configuration and Plaid connection. Connecting one device does not share Plaid credentials with another device.

## Disconnect

In Settings, disconnect an institution to remove its Plaid credentials and sync state from the companion. You can choose whether to keep or delete the transactions already imported from its accounts. Disconnecting does not remove a separate Google Drive backup.

## Troubleshooting

- **Companion not found:** Confirm it is installed and running. For the hosted web app, run `plaid-companion serve` and retry pairing. If the one-time code has already been used or expired, restart the companion to get a new code.
- **Browser cannot connect:** Check the browser's local network permission for Budgetzilla and confirm the companion is bound to the local computer only.
- **Institution needs attention:** Follow Plaid Link's reconnect flow from the Plaid section in Settings.
- **No new transactions:** The institution may not have delivered new data to Plaid yet. Try again later or use **Sync now**.
