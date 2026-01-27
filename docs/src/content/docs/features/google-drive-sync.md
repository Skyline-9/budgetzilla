---
title: Google Drive Sync
description: Optional cloud backup for your data.
---

Budget can optionally sync your data to Google Drive for backup and cross-device access.

## How It Works

- Your data is exported as a file to your Google Drive
- The file is stored in a Budget app folder
- Sync can be manual or automatic
- You maintain full control over the data

## Setting Up Sync

1. Go to **Settings > Cloud Sync**
2. Click **Connect Google Drive**
3. Sign in with your Google account
4. Grant permission to the Budget app folder only
5. Sync is now enabled

## Permissions

Budget requests minimal permissions:

- **App folder access only** — Budget can only access its own folder
- **No access to other files** — Your other Drive files remain private
- **Revocable anytime** — Remove access from Google account settings

## Sync Options

### Manual Sync

Click **Sync Now** in Settings to:

- Upload your current data to Drive
- Download the latest version from Drive

### Conflict Resolution

If both local and cloud data have changed:

1. You'll see a conflict notification
2. Choose to keep local, keep cloud, or merge
3. The selected version becomes the new source of truth

## Using Multiple Devices

With Google Drive sync:

1. Set up Budget on each device
2. Connect the same Google account
3. Sync before and after making changes

:::caution
Budget is designed as a single-user app. Simultaneous edits from multiple devices may cause conflicts.
:::

## Disconnecting

To stop syncing:

1. Go to **Settings > Cloud Sync**
2. Click **Disconnect**
3. Your local data remains intact
4. The Drive folder and data are not deleted

## Privacy

- Data is stored in your personal Google Drive
- Budget servers never see your financial data
- All sync happens directly between your browser and Drive
- You can delete the synced data from Drive anytime
