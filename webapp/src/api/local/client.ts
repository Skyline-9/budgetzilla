/**
 * Local API client using SQLite WASM.
 * Implements the same ApiClient interface as the real (HTTP) client.
 */
import type { ApiClient, GetTransactionsParams, GetDashboardParams } from "@/api/types";
import type {
  CategoryCreate,
  CategoryUpdate,
  TransactionCreate,
  TransactionUpdate,
  DriveStatus,
  DriveSyncResponse,
} from "@/types";
import * as db from "@/db";

// Drive service will be injected later
let driveService: {
  getStatus: () => Promise<DriveStatus>;
  getAuthUrl: () => Promise<string>;
  smartSync: () => Promise<DriveSyncResponse>;
  push: () => Promise<DriveSyncResponse>;
  pull: () => Promise<DriveSyncResponse>;
  disconnect: () => Promise<void>;
} | null = null;

/**
 * Set the drive service for sync operations.
 * Called during app initialization after Google APIs are loaded.
 */
export function setDriveService(service: typeof driveService): void {
  driveService = service;
}

/**
 * Local API client - all operations are performed locally using SQLite.
 */
export const localApiClient: ApiClient = {
  // ==================== Transactions ====================

  async getTransactions(params: GetTransactionsParams) {
    return db.getTransactions({
      from: params.from,
      to: params.to,
      q: params.q,
      categoryId: params.categoryId,
      minAmountCents: params.minAmountCents,
      maxAmountCents: params.maxAmountCents,
    });
  },

  async createTransaction(payload: TransactionCreate) {
    return db.createTransaction(payload);
  },

  async updateTransaction(id: string, payload: TransactionUpdate) {
    return db.updateTransaction(id, payload);
  },

  async deleteTransaction(id: string) {
    await db.deleteTransaction(id);
    return { ok: true as const };
  },

  // ==================== Categories ====================

  async getCategories() {
    return db.getCategories();
  },

  async createCategory(payload: CategoryCreate) {
    return db.createCategory(payload);
  },

  async updateCategory(id: string, payload: CategoryUpdate) {
    return db.updateCategory(id, payload);
  },

  async deleteCategory(id: string, opts: { reassignToCategoryId: string }) {
    await db.deleteCategory(id, opts.reassignToCategoryId);
    return { ok: true as const };
  },

  // ==================== Budgets ====================

  async getOverallBudget(month: string) {
    return db.getOverallBudget(month);
  },

  async upsertOverallBudget(payload: { month: string; budgetCents: number }) {
    return db.upsertOverallBudget(payload.month, payload.budgetCents);
  },

  async deleteOverallBudget(month: string) {
    await db.deleteOverallBudget(month);
    return { ok: true as const };
  },

  // ==================== Dashboard ====================

  async getDashboardSummary(params: GetDashboardParams) {
    return db.getDashboardSummary({
      from: params.from,
      to: params.to,
      q: params.q,
      categoryId: params.categoryId,
      minAmountCents: params.minAmountCents,
      maxAmountCents: params.maxAmountCents,
    });
  },

  async getDashboardCharts(params: GetDashboardParams) {
    return db.getDashboardCharts({
      from: params.from,
      to: params.to,
      q: params.q,
      categoryId: params.categoryId,
      minAmountCents: params.minAmountCents,
      maxAmountCents: params.maxAmountCents,
    });
  },

  // ==================== Google Drive ====================

  async getDriveStatus(): Promise<DriveStatus> {
    if (!driveService) {
      return {
        connected: false,
        mode: "none",
        last_sync_at: null,
        folder_id: null,
        files: [],
      };
    }
    return driveService.getStatus();
  },

  async getDriveAuthUrl(): Promise<string> {
    if (!driveService) {
      throw new Error("Drive service not initialized");
    }
    return driveService.getAuthUrl();
  },

  async smartSync(): Promise<DriveSyncResponse> {
    if (!driveService) {
      throw new Error("Drive service not initialized");
    }
    return driveService.smartSync();
  },

  async pushDrive(): Promise<DriveSyncResponse> {
    if (!driveService) {
      throw new Error("Drive service not initialized");
    }
    return driveService.push();
  },

  async pullDrive(): Promise<DriveSyncResponse> {
    if (!driveService) {
      throw new Error("Drive service not initialized");
    }
    return driveService.pull();
  },

  async disconnectDrive(): Promise<{ ok: true }> {
    if (!driveService) {
      throw new Error("Drive service not initialized");
    }
    await driveService.disconnect();
    return { ok: true };
  },
};
