import { applyPlaidChanges } from "@/db/plaid";
import { plaidCompanion } from "./plaidCompanion";
import type { PlaidApplyResult } from "@/types/plaid";

const openedSyncs = new Set<string>();

export async function syncPlaidItem(itemId: string): Promise<PlaidApplyResult> {
  const batch = await plaidCompanion.syncItem(itemId);
  const result = await applyPlaidChanges({
    // The companion normalizes Plaid amounts to Budgetzilla's expense-negative convention.
    added: batch.added,
    modified: batch.modified,
    removed: batch.removed,
  });
  await plaidCompanion.ackSyncBatch(itemId, batch.batchId);
  return result;
}

export async function syncPlaidItemsOnOpen(itemIds: string[]): Promise<void> {
  await Promise.all(itemIds.filter((id) => !openedSyncs.has(id)).map(async (id) => {
    openedSyncs.add(id);
    try { await syncPlaidItem(id); } catch (error) { openedSyncs.delete(id); throw error; }
  }));
}
