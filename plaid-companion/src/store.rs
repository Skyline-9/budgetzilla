use crate::{CompanionError, SecretStore};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::Path,
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Item {
    pub item_id: String,
    pub institution_id: Option<String>,
    pub institution_name: String,
    pub status: String,
    pub last_sync_at: Option<String>,
    pub error_message: Option<String>,
    pub created_at: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaidAccount {
    pub account_id: String,
    pub item_id: Option<String>,
    pub institution_name: Option<String>,
    pub name: String,
    pub mask: Option<String>,
    #[serde(rename = "type")]
    pub account_type: String,
    pub subtype: Option<String>,
    pub enabled: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransactionChange {
    pub transaction_id: String,
    pub account_id: String,
    pub date: String,
    pub authorized_date: Option<String>,
    pub amount_cents: i64,
    pub merchant: Option<String>,
    pub pending: bool,
    pub pending_transaction_id: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemovedTransaction {
    pub transaction_id: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingBatch {
    pub batch_id: String,
    pub item_id: String,
    pub added: Vec<TransactionChange>,
    pub modified: Vec<TransactionChange>,
    pub removed: Vec<RemovedTransaction>,
    pub completed_at: String,
}

pub struct Database {
    connection: Mutex<Connection>,
}

impl Database {
    pub fn open(path: &Path) -> Result<Self, CompanionError> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        let connection = Connection::open(path)?;
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(path, fs::Permissions::from_mode(0o600))?;
        }
        connection.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA foreign_keys = ON;
             CREATE TABLE IF NOT EXISTS items (
               item_id TEXT PRIMARY KEY,
               institution_id TEXT,
               institution_name TEXT,
               status TEXT NOT NULL DEFAULT 'healthy',
               last_sync_at TEXT,
               error_message TEXT,
               created_at INTEGER NOT NULL
             );
             CREATE TABLE IF NOT EXISTS accounts (
               account_id TEXT PRIMARY KEY,
               item_id TEXT NOT NULL REFERENCES items(item_id) ON DELETE CASCADE,
               institution_name TEXT,
               name TEXT NOT NULL,
               mask TEXT,
               account_type TEXT NOT NULL,
               subtype TEXT,
               enabled INTEGER NOT NULL DEFAULT 1
             );
             CREATE TABLE IF NOT EXISTS cursors (
               item_id TEXT PRIMARY KEY REFERENCES items(item_id) ON DELETE CASCADE,
               cursor TEXT NOT NULL
             );
             CREATE TABLE IF NOT EXISTS pending_batches (
               item_id TEXT PRIMARY KEY REFERENCES items(item_id) ON DELETE CASCADE,
               batch_id TEXT NOT NULL UNIQUE,
               next_cursor TEXT NOT NULL,
               payload TEXT NOT NULL,
               created_at INTEGER NOT NULL
             );
             CREATE TABLE IF NOT EXISTS paired_clients (
               token_hash TEXT PRIMARY KEY,
               origin TEXT NOT NULL,
               created_at INTEGER NOT NULL
             );",
        )?;
        // Keep databases from early companion builds usable after adding Item status fields.
        let _ = connection.execute(
            "ALTER TABLE items ADD COLUMN status TEXT NOT NULL DEFAULT 'healthy'",
            [],
        );
        let _ = connection.execute("ALTER TABLE items ADD COLUMN last_sync_at TEXT", []);
        let _ = connection.execute("ALTER TABLE items ADD COLUMN error_message TEXT", []);
        Ok(Self {
            connection: Mutex::new(connection),
        })
    }

    pub fn item_count(&self) -> Result<usize, CompanionError> {
        let connection = self.connection.lock().expect("database mutex poisoned");
        Ok(
            connection.query_row("SELECT count(*) FROM items", [], |row| row.get::<_, i64>(0))?
                as usize,
        )
    }

    pub fn add_item(&self, item: &Item) -> Result<(), CompanionError> {
        let connection = self.connection.lock().expect("database mutex poisoned");
        connection.execute("INSERT INTO items(item_id,institution_id,institution_name,status,last_sync_at,error_message,created_at) VALUES (?1,?2,?3,?4,?5,?6,?7)", params![item.item_id, item.institution_id, item.institution_name, item.status, item.last_sync_at, item.error_message, item.created_at])?;
        Ok(())
    }

    pub fn items(&self) -> Result<Vec<Item>, CompanionError> {
        let connection = self.connection.lock().expect("database mutex poisoned");
        let mut statement = connection.prepare("SELECT item_id,institution_id,institution_name,status,last_sync_at,error_message,created_at FROM items ORDER BY created_at")?;
        let rows = statement.query_map([], |row| {
            Ok(Item {
                item_id: row.get(0)?,
                institution_id: row.get(1)?,
                institution_name: row.get(2)?,
                status: row.get(3)?,
                last_sync_at: row.get(4)?,
                error_message: row.get(5)?,
                created_at: row.get(6)?,
            })
        })?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    pub fn save_accounts(&self, accounts: &[PlaidAccount]) -> Result<(), CompanionError> {
        let mut connection = self.connection.lock().expect("database mutex poisoned");
        let transaction = connection.transaction()?;
        for account in accounts {
            transaction.execute("INSERT INTO accounts(account_id,item_id,institution_name,name,mask,account_type,subtype,enabled) VALUES (?1,?2,?3,?4,?5,?6,?7,?8) ON CONFLICT(account_id) DO UPDATE SET item_id=excluded.item_id,institution_name=excluded.institution_name,name=excluded.name,mask=excluded.mask,account_type=excluded.account_type,subtype=excluded.subtype", params![account.account_id, account.item_id, account.institution_name, account.name, account.mask, account.account_type, account.subtype, account.enabled as i64])?;
        }
        transaction.commit()?;
        Ok(())
    }

    pub fn accounts_for_item(&self, item_id: &str) -> Result<Vec<PlaidAccount>, CompanionError> {
        let connection = self.connection.lock().expect("database mutex poisoned");
        let mut statement = connection.prepare("SELECT account_id,item_id,institution_name,name,mask,account_type,subtype,enabled FROM accounts WHERE item_id=?1 ORDER BY name")?;
        let rows = statement.query_map([item_id], |row| {
            Ok(PlaidAccount {
                account_id: row.get(0)?,
                item_id: row.get(1)?,
                institution_name: row.get(2)?,
                name: row.get(3)?,
                mask: row.get(4)?,
                account_type: row.get(5)?,
                subtype: row.get(6)?,
                enabled: row.get::<_, i64>(7)? != 0,
            })
        })?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    }

    pub fn set_account_enabled(
        &self,
        account_id: &str,
        enabled: bool,
    ) -> Result<bool, CompanionError> {
        let connection = self.connection.lock().expect("database mutex poisoned");
        Ok(connection.execute(
            "UPDATE accounts SET enabled=?1 WHERE account_id=?2",
            params![enabled as i64, account_id],
        )? > 0)
    }

    pub fn remove_item(&self, item_id: &str) -> Result<bool, CompanionError> {
        let connection = self.connection.lock().expect("database mutex poisoned");
        Ok(connection.execute("DELETE FROM items WHERE item_id=?1", [item_id])? > 0)
    }

    pub fn cursor(&self, item_id: &str) -> Result<Option<String>, CompanionError> {
        let connection = self.connection.lock().expect("database mutex poisoned");
        Ok(connection
            .query_row(
                "SELECT cursor FROM cursors WHERE item_id=?1",
                [item_id],
                |row| row.get(0),
            )
            .optional()?)
    }

    pub fn pending_batch(&self, item_id: &str) -> Result<Option<PendingBatch>, CompanionError> {
        let connection = self.connection.lock().expect("database mutex poisoned");
        let json: Option<String> = connection
            .query_row(
                "SELECT payload FROM pending_batches WHERE item_id=?1",
                [item_id],
                |row| row.get(0),
            )
            .optional()?;
        json.map(|s| serde_json::from_str(&s).map_err(|e| CompanionError::Config(e.to_string())))
            .transpose()
    }

    pub fn save_pending(
        &self,
        batch: &PendingBatch,
        next_cursor: &str,
    ) -> Result<(), CompanionError> {
        let payload =
            serde_json::to_string(batch).map_err(|e| CompanionError::Config(e.to_string()))?;
        let mut connection = self.connection.lock().expect("database mutex poisoned");
        let transaction = connection.transaction()?;
        transaction.execute("INSERT INTO pending_batches(item_id,batch_id,next_cursor,payload,created_at) VALUES (?1,?2,?3,?4,?5)", params![batch.item_id, batch.batch_id, next_cursor, payload, now()])?;
        transaction.commit()?;
        Ok(())
    }

    /// Cursor movement and pending-batch deletion are one SQLite transaction.
    pub fn acknowledge(&self, item_id: &str, batch_id: &str) -> Result<bool, CompanionError> {
        let mut connection = self.connection.lock().expect("database mutex poisoned");
        let transaction = connection.transaction()?;
        let next_cursor: Option<String> = transaction
            .query_row(
                "SELECT next_cursor FROM pending_batches WHERE item_id=?1 AND batch_id=?2",
                params![item_id, batch_id],
                |row| row.get(0),
            )
            .optional()?;
        let Some(next_cursor) = next_cursor else {
            transaction.rollback()?;
            return Ok(false);
        };
        transaction.execute("INSERT INTO cursors(item_id,cursor) VALUES (?1,?2) ON CONFLICT(item_id) DO UPDATE SET cursor=excluded.cursor", params![item_id, next_cursor])?;
        transaction.execute(
            "UPDATE items SET last_sync_at=?1 WHERE item_id=?2",
            params![chrono::Utc::now().to_rfc3339(), item_id],
        )?;
        transaction.execute("DELETE FROM pending_batches WHERE item_id=?1", [item_id])?;
        transaction.commit()?;
        Ok(true)
    }

    pub fn add_pair(&self, token_hash: &str, origin: &str) -> Result<(), CompanionError> {
        let connection = self.connection.lock().expect("database mutex poisoned");
        connection.execute(
            "INSERT INTO paired_clients(token_hash,origin,created_at) VALUES (?1,?2,?3)",
            params![token_hash, origin, now()],
        )?;
        Ok(())
    }

    pub fn paired_origin(&self, token_hash: &str) -> Result<Option<String>, CompanionError> {
        let connection = self.connection.lock().expect("database mutex poisoned");
        Ok(connection
            .query_row(
                "SELECT origin FROM paired_clients WHERE token_hash=?1",
                [token_hash],
                |row| row.get(0),
            )
            .optional()?)
    }

    pub fn revoke_pairs(&self) -> Result<(), CompanionError> {
        let connection = self.connection.lock().expect("database mutex poisoned");
        connection.execute("DELETE FROM paired_clients", [])?;
        Ok(())
    }

    pub fn has_pairs(&self) -> Result<bool, CompanionError> {
        let connection = self.connection.lock().expect("database mutex poisoned");
        Ok(
            connection.query_row("SELECT EXISTS(SELECT 1 FROM paired_clients)", [], |row| {
                row.get(0)
            })?,
        )
    }
}

pub fn save_access_token(
    secrets: &dyn SecretStore,
    item_id: &str,
    token: &str,
) -> Result<(), CompanionError> {
    secrets.set(&format!("item-access-token:{item_id}"), token)
}

pub fn access_token(secrets: &dyn SecretStore, item_id: &str) -> Result<String, CompanionError> {
    secrets.get(&format!("item-access-token:{item_id}"))
}

pub fn delete_access_token(secrets: &dyn SecretStore, item_id: &str) -> Result<(), CompanionError> {
    secrets.delete(&format!("item-access-token:{item_id}"))
}

pub(crate) fn now() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_db() -> (Database, std::path::PathBuf) {
        let path =
            std::env::temp_dir().join(format!("budgetzilla-sync-{}.sqlite", uuid::Uuid::new_v4()));
        (Database::open(&path).unwrap(), path)
    }

    #[test]
    fn cursor_advances_only_after_exact_batch_ack_and_pending_is_repeatable() {
        let (db, path) = temp_db();
        let item = Item {
            item_id: "item-1".into(),
            institution_id: None,
            institution_name: "Test bank".into(),
            status: "healthy".into(),
            last_sync_at: None,
            error_message: None,
            created_at: now(),
        };
        db.add_item(&item).unwrap();
        let batch = PendingBatch {
            batch_id: "batch-1".into(),
            item_id: item.item_id.clone(),
            added: vec![],
            modified: vec![],
            removed: vec![],
            completed_at: chrono::Utc::now().to_rfc3339(),
        };
        db.save_pending(&batch, "cursor-2").unwrap();
        drop(db);
        let db = Database::open(&path).unwrap();
        assert_eq!(db.cursor(&item.item_id).unwrap(), None);
        assert_eq!(
            db.pending_batch(&item.item_id).unwrap().unwrap().batch_id,
            "batch-1"
        );
        assert!(!db.acknowledge(&item.item_id, "wrong-batch").unwrap());
        assert_eq!(db.cursor(&item.item_id).unwrap(), None);
        assert!(db.acknowledge(&item.item_id, "batch-1").unwrap());
        assert_eq!(
            db.cursor(&item.item_id).unwrap().as_deref(),
            Some("cursor-2")
        );
        assert!(db.pending_batch(&item.item_id).unwrap().is_none());
        drop(db);
        let _ = fs::remove_file(&path);
        let _ = fs::remove_file(path.with_extension("sqlite-wal"));
        let _ = fs::remove_file(path.with_extension("sqlite-shm"));
    }
}
