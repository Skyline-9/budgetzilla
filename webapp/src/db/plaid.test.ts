// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { closeDatabase, execSQL, initDatabase, runSQL } from "./sqlite";
import { runMigrations } from "./schema";
import { applyPlaidChanges, getPlaidAccounts, setPlaidAccountEnabled, upsertPlaidAccounts } from "./plaid";

async function setup() { await initDatabase(); await runMigrations(); }

describe("Plaid SQLite persistence", () => {
  beforeEach(() => vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} }));
  afterEach(async () => { await closeDatabase(); vi.unstubAllGlobals(); });

  it("adds provenance without losing pre-existing transactions", async () => {
    await setup();
    const now = new Date().toISOString();
    await runSQL("INSERT INTO transactions(id,date,amount_cents,category_id,created_at,updated_at,deleted) VALUES('old','2026-01-01',-500,'',?, ?,0)", [now, now]);
    await runMigrations();
    const rows = await execSQL("SELECT amount_cents,source FROM transactions WHERE id='old'");
    expect(rows[0]).toEqual([-500, null]);
  });

  it("is idempotent and preserves category and notes while reconciling pending rows", async () => {
    await setup();
    await upsertPlaidAccounts([{ accountId: "acct", itemId: "item", institutionName: "Bank", name: "Checking", type: "depository", enabled: true }]);
    const change = { transactionId: "pending", accountId: "acct", date: "2026-01-01", amountCents: -1250, merchant: "Shop", pending: true };
    expect(await applyPlaidChanges({ added: [change], modified: [], removed: [] })).toEqual({ added: 1, modified: 0, removed: 0 });
    await runSQL("UPDATE transactions SET notes='my note' WHERE source_transaction_id='pending'");
    const [before] = await execSQL("SELECT id,category_id FROM transactions WHERE source_transaction_id='pending'");
    expect(await applyPlaidChanges({ added: [change], modified: [], removed: [] })).toEqual({ added: 0, modified: 1, removed: 0 });
    expect(await applyPlaidChanges({ added: [{ ...change, transactionId: "posted", pending: false, pendingTransactionId: "pending" }], modified: [], removed: [] })).toEqual({ added: 0, modified: 1, removed: 0 });
    const [after] = await execSQL("SELECT id,category_id,notes,source_transaction_id FROM transactions WHERE source='plaid'");
    expect(after).toEqual([before[0], before[1], "my note", "posted"]);
    expect(await getPlaidAccounts()).toHaveLength(1);
  });

  it("soft deletes provider removals", async () => {
    await setup();
    await upsertPlaidAccounts([{ accountId: "acct", itemId: "item", name: "Checking", type: "depository", enabled: true }]);
    await applyPlaidChanges({ added: [{ transactionId: "gone", accountId: "acct", date: "2026-01-01", amountCents: -100, pending: false }], modified: [], removed: [] });
    await applyPlaidChanges({ added: [], modified: [], removed: [{ transactionId: "gone" }] });
    const [row] = await execSQL("SELECT deleted FROM transactions WHERE source_transaction_id='gone'");
    expect(row[0]).toBe(1);
  });

  it("defers disabled-account changes until the account is re-enabled", async () => {
    await setup();
    await upsertPlaidAccounts([{ accountId: "acct", itemId: "item", name: "Checking", type: "depository", enabled: false }]);
    const change = { transactionId: "deferred", accountId: "acct", date: "2026-01-01", amountCents: -100, pending: false };
    expect(await applyPlaidChanges({ added: [change], modified: [], removed: [] })).toEqual({ added: 0, modified: 0, removed: 0 });
    expect(await execSQL("SELECT id FROM transactions WHERE source_transaction_id='deferred'")).toHaveLength(0);
    await setPlaidAccountEnabled("acct", true);
    expect(await execSQL("SELECT amount_cents FROM transactions WHERE source_transaction_id='deferred'")).toEqual([[-100]]);
    expect(await execSQL("SELECT id FROM plaid_pending_changes WHERE account_id='acct'")).toHaveLength(0);
  });
});
