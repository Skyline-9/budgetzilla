import { describe, expect, it, vi } from "vitest";
import { applyPlaidChanges } from "@/db/plaid";
import { plaidCompanion } from "./plaidCompanion";
import { syncPlaidItem } from "./plaidImport";

vi.mock("@/db/plaid", () => ({ applyPlaidChanges: vi.fn(async () => ({ added: 1, modified: 2, removed: 3 })) }));
vi.mock("./plaidCompanion", () => ({ plaidCompanion: { syncItem: vi.fn(async () => ({ itemId: "item", batchId: "batch", completedAt: "now", added: [{ transactionId: "tx", accountId: "acct", date: "2026-01-01", amountCents: 123, pending: false }], modified: [], removed: [] })), ackSyncBatch: vi.fn() } }));

describe("Plaid batch importer", () => {
  it("applies normalized changes before acknowledging the durable batch", async () => {
    await expect(syncPlaidItem("item")).resolves.toEqual({ added: 1, modified: 2, removed: 3 });
    expect(applyPlaidChanges).toHaveBeenCalledWith(expect.objectContaining({ added: [expect.objectContaining({ amountCents: 123 })] }));
    expect(plaidCompanion.ackSyncBatch).toHaveBeenCalledWith("item", "batch");
  });
});
