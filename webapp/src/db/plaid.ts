import { execSQL, persistDatabase, runSQL } from "./sqlite";
import type { PlaidAccount, PlaidApplyResult, PlaidChanges } from "@/types/plaid";

type AccountRow = [string, string, string, string, string | null, string, string | null, number];

export async function getPlaidAccounts(): Promise<PlaidAccount[]> {
  const rows = await execSQL(`SELECT account_id, item_id, institution_name, name, mask, type, subtype, enabled
    FROM plaid_accounts ORDER BY institution_name, name`) as AccountRow[];
  return rows.map((r) => ({ accountId: r[0], itemId: r[1], institutionName: r[2], name: r[3], mask: r[4] ?? undefined,
    type: r[5], subtype: r[6] ?? undefined, enabled: r[7] === 1 }));
}

export async function upsertPlaidAccounts(accounts: PlaidAccount[]): Promise<void> {
  const now = new Date().toISOString();
  await runSQL("BEGIN TRANSACTION");
  try {
    for (const account of accounts) {
      if (!account.itemId) throw new Error("Plaid account is missing its Item ID");
      await runSQL(`INSERT INTO plaid_accounts(account_id,item_id,institution_name,name,mask,type,subtype,enabled,created_at,updated_at)
        VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(account_id) DO UPDATE SET item_id=excluded.item_id,
        institution_name=excluded.institution_name,name=excluded.name,mask=excluded.mask,type=excluded.type,
        subtype=excluded.subtype,enabled=excluded.enabled,updated_at=excluded.updated_at`,
        [account.accountId, account.itemId, account.institutionName ?? "", account.name,
          account.mask ?? null, account.type, account.subtype ?? null, account.enabled ? 1 : 0, now, now]);
    }
    await runSQL("COMMIT");
    await persistDatabase();
  } catch (error) {
    await runSQL("ROLLBACK");
    throw error;
  }
}

export async function setPlaidAccountEnabled(accountId: string, enabled: boolean): Promise<void> {
  await runSQL("UPDATE plaid_accounts SET enabled=?, updated_at=? WHERE account_id=?", [enabled ? 1 : 0, new Date().toISOString(), accountId]);
  await persistDatabase();
  if (!enabled) return;

  const queued = await execSQL("SELECT id,payload FROM plaid_pending_changes WHERE account_id=? ORDER BY id", [accountId]);
  for (const [id, payload] of queued) {
    await applyPlaidChanges(JSON.parse(String(payload)) as PlaidChanges);
    await runSQL("DELETE FROM plaid_pending_changes WHERE id=?", [id]);
    await persistDatabase();
  }
}

export async function removePlaidItemData(itemId: string, deleteTransactions: boolean): Promise<void> {
  await runSQL("BEGIN TRANSACTION");
  try {
    if (deleteTransactions) {
      await runSQL(`DELETE FROM transactions WHERE source='plaid' AND source_account_id IN
        (SELECT account_id FROM plaid_accounts WHERE item_id=?)`, [itemId]);
    }
    await runSQL("DELETE FROM plaid_pending_changes WHERE account_id IN (SELECT account_id FROM plaid_accounts WHERE item_id=?)", [itemId]);
    await runSQL("DELETE FROM plaid_accounts WHERE item_id=?", [itemId]);
    await runSQL("COMMIT");
    await persistDatabase();
  } catch (error) {
    await runSQL("ROLLBACK");
    throw error;
  }
}

async function uncategorizedId(kind: "expense" | "income"): Promise<string> {
  const rows = await execSQL("SELECT id FROM categories WHERE name='Uncategorized' AND kind=? ORDER BY active DESC LIMIT 1", [kind]);
  if (rows.length) return rows[0][0] as string;
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await runSQL("INSERT INTO categories(id,name,kind,parent_id,active,created_at,updated_at) VALUES(?,?,?,NULL,1,?,?)", [id,"Uncategorized",kind,now,now]);
  return id;
}

export async function applyPlaidChanges(changes: PlaidChanges): Promise<PlaidApplyResult> {
  let added = 0, modified = 0, removed = 0;
  await runSQL("BEGIN TRANSACTION");
  try {
    const apply = async (change: PlaidChanges["added"][number], isAdded: boolean) => {
      const account = await execSQL("SELECT enabled FROM plaid_accounts WHERE account_id=?", [change.accountId]);
      if (account.length && Number(account[0][0]) !== 1) {
        await runSQL("INSERT INTO plaid_pending_changes(account_id,payload,created_at) VALUES(?,?,?)", [
          change.accountId, JSON.stringify({ added: [change], modified: [], removed: [] }), new Date().toISOString(),
        ]);
        return;
      }
      const existing = await execSQL(`SELECT id,category_id,notes FROM transactions
        WHERE source='plaid' AND source_transaction_id=? LIMIT 1`, [change.transactionId]);
      const pending = change.pendingTransactionId ? await execSQL(`SELECT id,category_id,notes FROM transactions
        WHERE source='plaid' AND source_transaction_id=? LIMIT 1`, [change.pendingTransactionId]) : [];
      const row = existing[0] ?? pending[0];
      const id = row ? String(row[0]) : crypto.randomUUID();
      const categoryId = row ? String(row[1]) : await uncategorizedId(change.amountCents < 0 ? "expense" : "income");
      const notes = row?.[2] ?? null;
      const now = new Date().toISOString();
      if (row) {
        await runSQL(`UPDATE transactions SET date=?,amount_cents=?,merchant=?,source='plaid',source_account_id=?,
          source_transaction_id=?,deleted=0,updated_at=? WHERE id=?`,
          [change.date, change.amountCents, change.merchant ?? null, change.accountId, change.transactionId, now, id]);
        modified++;
      } else {
        await runSQL(`INSERT INTO transactions(id,date,amount_cents,category_id,merchant,notes,created_at,updated_at,deleted,source,source_account_id,source_transaction_id)
          VALUES(?,?,?,?,?,?,?, ?,0,'plaid',?,?)`, [id,change.date,change.amountCents,categoryId,change.merchant ?? null,notes,now,now,change.accountId,change.transactionId]);
        if (isAdded) added++;
      }
    };
    for (const change of changes.added) await apply(change, true);
    for (const change of changes.modified) await apply(change, false);
    for (const item of changes.removed) {
      const existing = await execSQL("SELECT source_account_id FROM transactions WHERE source='plaid' AND source_transaction_id=? LIMIT 1", [item.transactionId]);
      const accountId = existing[0]?.[0] == null ? null : String(existing[0][0]);
      const account = accountId ? await execSQL("SELECT enabled FROM plaid_accounts WHERE account_id=?", [accountId]) : [];
      if (accountId && account.length && Number(account[0][0]) !== 1) {
        await runSQL("INSERT INTO plaid_pending_changes(account_id,payload,created_at) VALUES(?,?,?)", [
          accountId, JSON.stringify({ added: [], modified: [], removed: [item] }), new Date().toISOString(),
        ]);
        continue;
      }
      await runSQL("UPDATE transactions SET deleted=1,updated_at=? WHERE source='plaid' AND source_transaction_id=?", [new Date().toISOString(), item.transactionId]);
      removed++;
    }
    await runSQL("COMMIT");
    await persistDatabase();
    return { added, modified, removed };
  } catch (error) {
    await runSQL("ROLLBACK");
    throw error;
  }
}
