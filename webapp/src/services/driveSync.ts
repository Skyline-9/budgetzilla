/**
 * Google Drive sync service.
 * Syncs the SQLite database to Google Drive as a single file.
 */
import { exportDatabase, importDatabase, persistDatabase } from "@/db/sqlite";
import { runMigrations } from "@/db/schema";
import {
  ensureAuthenticated,
  getGapiClient,
  isAuthenticated,
  revokeToken,
  requestAccessTokenWithConsent,
  getStoredToken,
  setClientId,
  initGoogleAuth,
} from "./googleAuth";
import type { DriveStatus, DriveSyncResponse, DriveSyncResult } from "@/types";

// Constants
const DB_FILENAME = "budget.sqlite";
const STATE_KEY = "drive_sync_state";
const MIME_TYPE = "application/octet-stream";

// Sync state stored in localStorage
interface SyncState {
  fileId?: string;
  lastSyncAt?: string;
  driveMd5?: string;
  localHash?: string;
}

/**
 * Get the current sync state from localStorage.
 */
function getSyncState(): SyncState {
  try {
    const stored = localStorage.getItem(STATE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

/**
 * Save sync state to localStorage.
 */
function saveSyncState(state: SyncState): void {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

/**
 * Clear sync state.
 */
function clearSyncState(): void {
  localStorage.removeItem(STATE_KEY);
}

/**
 * Calculate a simple hash of the database content.
 * Uses a fast hash for change detection (not cryptographic).
 */
async function hashDatabase(): Promise<string> {
  const data = exportDatabase();
  // Simple FNV-1a hash for speed
  let hash = 2166136261;
  for (let i = 0; i < data.length; i++) {
    hash ^= data[i];
    hash = (hash * 16777619) >>> 0;
  }
  return hash.toString(16);
}

/**
 * Find the database file in Drive's appDataFolder.
 */
async function findDriveFile(): Promise<{ id: string; md5Checksum?: string; modifiedTime?: string } | null> {
  const client = getGapiClient();
  if (!client) throw new Error("Google API client not loaded");

  const response = await client.drive.files.list({
    spaces: "appDataFolder",
    q: `name='${DB_FILENAME}' and trashed=false`,
    fields: "files(id,name,md5Checksum,modifiedTime)",
    pageSize: 1,
  });

  const files = response.result.files;
  if (files && files.length > 0) {
    return {
      id: files[0].id!,
      md5Checksum: files[0].md5Checksum,
      modifiedTime: files[0].modifiedTime,
    };
  }
  return null;
}

/**
 * Upload the database to Drive.
 */
async function uploadDatabase(existingFileId?: string): Promise<{ id: string; md5Checksum: string }> {
  const token = getStoredToken();
  if (!token) throw new Error("Not authenticated");

  const data = exportDatabase();
  // Create a copy of the buffer to ensure it's a proper ArrayBuffer
  const buffer = new Uint8Array(data).buffer as ArrayBuffer;
  const blob = new Blob([buffer], { type: MIME_TYPE });

  if (existingFileId) {
    // Update existing file
    const response = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=media&fields=id,md5Checksum`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": MIME_TYPE,
        },
        body: blob,
      }
    );

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  } else {
    // Create new file in appDataFolder
    const metadata = {
      name: DB_FILENAME,
      parents: ["appDataFolder"],
    };

    const form = new FormData();
    form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
    form.append("file", blob);

    const response = await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,md5Checksum",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: form,
      }
    );

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }
}

/**
 * Download the database from Drive.
 */
async function downloadDatabase(fileId: string): Promise<Uint8Array> {
  const token = getStoredToken();
  if (!token) throw new Error("Not authenticated");

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }

  const buffer = await response.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Get the current drive status.
 */
export async function getStatus(): Promise<DriveStatus> {
  const connected = isAuthenticated();
  const state = getSyncState();

  return {
    connected,
    mode: "appdata",
    last_sync_at: state.lastSyncAt ?? null,
    folder_id: null,
    files: [
      {
        filename: DB_FILENAME,
        file_id: state.fileId ?? null,
        drive_md5: state.driveMd5 ?? null,
        drive_modified_time: null,
        local_sha256: state.localHash ?? null,
      },
    ],
  };
}

/**
 * Get the OAuth authorization URL (for compatibility with existing UI).
 * In browser-based auth, this triggers the popup flow directly.
 */
export async function getAuthUrl(): Promise<string> {
  // For browser-based OAuth, we don't use a redirect URL
  // Instead, we return a special marker that the UI should interpret
  // as "trigger popup flow"
  return "popup://google-oauth";
}

/**
 * Connect to Google Drive (trigger OAuth flow).
 */
export async function connect(clientId: string): Promise<void> {
  setClientId(clientId);
  await initGoogleAuth(clientId);
  await requestAccessTokenWithConsent();
}

/**
 * Disconnect from Google Drive.
 */
export async function disconnect(): Promise<void> {
  await revokeToken();
  clearSyncState();
}

/**
 * Push local database to Drive.
 */
export async function push(): Promise<DriveSyncResponse> {
  await ensureAuthenticated();

  const results: DriveSyncResult[] = [];
  const state = getSyncState();

  try {
    const localHash = await hashDatabase();
    
    // Find existing file
    const driveFile = await findDriveFile();
    const fileId = driveFile?.id ?? state.fileId;

    // Upload
    const uploaded = await uploadDatabase(fileId);

    // Update state
    const newState: SyncState = {
      fileId: uploaded.id,
      lastSyncAt: new Date().toISOString(),
      driveMd5: uploaded.md5Checksum,
      localHash,
    };
    saveSyncState(newState);

    results.push({
      filename: DB_FILENAME,
      action: "push",
      status: "ok",
      message: fileId ? "Updated on Drive" : "Created on Drive",
    });
  } catch (err) {
    results.push({
      filename: DB_FILENAME,
      action: "push",
      status: "error",
      message: err instanceof Error ? err.message : "Push failed",
    });
  }

  return {
    mode: "appdata",
    results,
    last_sync_at: getSyncState().lastSyncAt ?? null,
  };
}

/**
 * Pull database from Drive.
 */
export async function pull(): Promise<DriveSyncResponse> {
  await ensureAuthenticated();

  const results: DriveSyncResult[] = [];
  const state = getSyncState();

  try {
    // Find the file
    const driveFile = await findDriveFile();
    const fileId = driveFile?.id ?? state.fileId;

    if (!fileId) {
      results.push({
        filename: DB_FILENAME,
        action: "pull",
        status: "skipped",
        message: "No file found on Drive",
      });
      return {
        mode: "appdata",
        results,
        last_sync_at: state.lastSyncAt ?? null,
      };
    }

    // Download
    const data = await downloadDatabase(fileId);

    // Import into SQLite
    await importDatabase(data);
    await runMigrations();

    // Update state
    const localHash = await hashDatabase();
    const newState: SyncState = {
      fileId,
      lastSyncAt: new Date().toISOString(),
      driveMd5: driveFile?.md5Checksum,
      localHash,
    };
    saveSyncState(newState);

    results.push({
      filename: DB_FILENAME,
      action: "pull",
      status: "ok",
      message: "Downloaded from Drive",
    });
  } catch (err) {
    results.push({
      filename: DB_FILENAME,
      action: "pull",
      status: "error",
      message: err instanceof Error ? err.message : "Pull failed",
    });
  }

  return {
    mode: "appdata",
    results,
    last_sync_at: getSyncState().lastSyncAt ?? null,
  };
}

/**
 * Smart sync - detect changes and sync accordingly.
 */
export async function smartSync(): Promise<DriveSyncResponse> {
  await ensureAuthenticated();

  const results: DriveSyncResult[] = [];
  const state = getSyncState();

  try {
    const localHash = await hashDatabase();
    const localChanged = state.localHash !== undefined && state.localHash !== localHash;

    // Check Drive
    const driveFile = await findDriveFile();
    const driveChanged = driveFile !== null && 
      state.driveMd5 !== undefined && 
      driveFile.md5Checksum !== state.driveMd5;

    // First sync or no Drive file
    if (!driveFile) {
      // No file on Drive - push
      const uploaded = await uploadDatabase();
      const newState: SyncState = {
        fileId: uploaded.id,
        lastSyncAt: new Date().toISOString(),
        driveMd5: uploaded.md5Checksum,
        localHash,
      };
      saveSyncState(newState);

      results.push({
        filename: DB_FILENAME,
        action: "push",
        status: "ok",
        message: "Created on Drive",
      });
      return {
        mode: "appdata",
        results,
        last_sync_at: newState.lastSyncAt,
      };
    }

    // No previous state - first sync with existing Drive file
    if (!state.fileId && !state.localHash) {
      // Pull from Drive for first sync
      const data = await downloadDatabase(driveFile.id);
      await importDatabase(data);
      await runMigrations();

      const newLocalHash = await hashDatabase();
      const newState: SyncState = {
        fileId: driveFile.id,
        lastSyncAt: new Date().toISOString(),
        driveMd5: driveFile.md5Checksum,
        localHash: newLocalHash,
      };
      saveSyncState(newState);

      results.push({
        filename: DB_FILENAME,
        action: "pull",
        status: "ok",
        message: "Initial sync from Drive",
      });
      return {
        mode: "appdata",
        results,
        last_sync_at: newState.lastSyncAt,
      };
    }

    // Neither changed
    if (!localChanged && !driveChanged) {
      results.push({
        filename: DB_FILENAME,
        action: "sync",
        status: "skipped",
        message: "No changes detected",
      });
      return {
        mode: "appdata",
        results,
        last_sync_at: state.lastSyncAt ?? null,
      };
    }

    // Only local changed - push
    if (localChanged && !driveChanged) {
      const uploaded = await uploadDatabase(driveFile.id);
      const newState: SyncState = {
        fileId: uploaded.id,
        lastSyncAt: new Date().toISOString(),
        driveMd5: uploaded.md5Checksum,
        localHash,
      };
      saveSyncState(newState);

      results.push({
        filename: DB_FILENAME,
        action: "push",
        status: "ok",
        message: "Updated on Drive",
      });
      return {
        mode: "appdata",
        results,
        last_sync_at: newState.lastSyncAt,
      };
    }

    // Only Drive changed - pull
    if (driveChanged && !localChanged) {
      const data = await downloadDatabase(driveFile.id);
      await importDatabase(data);
      await runMigrations();

      const newLocalHash = await hashDatabase();
      const newState: SyncState = {
        fileId: driveFile.id,
        lastSyncAt: new Date().toISOString(),
        driveMd5: driveFile.md5Checksum,
        localHash: newLocalHash,
      };
      saveSyncState(newState);

      results.push({
        filename: DB_FILENAME,
        action: "pull",
        status: "ok",
        message: "Updated from Drive",
      });
      return {
        mode: "appdata",
        results,
        last_sync_at: newState.lastSyncAt,
      };
    }

    // Both changed - conflict
    // Strategy: Keep local (more recent edits), save Drive version as backup
    results.push({
      filename: DB_FILENAME,
      action: "conflict",
      status: "conflict",
      message: "Both local and Drive changed. Local version kept, pushing to Drive.",
      conflict_local_copy: null, // In browser, we don't create conflict files
    });

    // Push local to overwrite Drive
    const uploaded = await uploadDatabase(driveFile.id);
    const newState: SyncState = {
      fileId: uploaded.id,
      lastSyncAt: new Date().toISOString(),
      driveMd5: uploaded.md5Checksum,
      localHash,
    };
    saveSyncState(newState);

    return {
      mode: "appdata",
      results,
      last_sync_at: newState.lastSyncAt,
    };
  } catch (err) {
    results.push({
      filename: DB_FILENAME,
      action: "sync",
      status: "error",
      message: err instanceof Error ? err.message : "Sync failed",
    });
    return {
      mode: "appdata",
      results,
      last_sync_at: state.lastSyncAt ?? null,
    };
  }
}

/**
 * Create the drive service object for the local API client.
 */
export function createDriveService() {
  return {
    getStatus,
    getAuthUrl,
    smartSync,
    push,
    pull,
    disconnect,
  };
}
