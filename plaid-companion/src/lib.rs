mod config;
mod plaid;
mod service;
mod store;

pub use config::default_data_dir;
pub use config::{AppConfig, Environment};
pub use plaid::{PlaidApi, PlaidError};
pub use service::{app, AppState};
pub use store::{
    Database, Item, PendingBatch, PlaidAccount, RemovedTransaction, TransactionChange,
};

use keyring::Entry;
use thiserror::Error;

const KEYRING_SERVICE: &str = "com.budgetzilla.plaid-companion";

#[derive(Debug, Error)]
pub enum CompanionError {
    #[error("operating-system credential store failed: {0}")]
    Credential(String),
    #[error("configuration error: {0}")]
    Config(String),
    #[error(transparent)]
    Database(#[from] rusqlite::Error),
    #[error(transparent)]
    Io(#[from] std::io::Error),
}

/// Secrets are deliberately routed through the OS credential store only.
pub trait SecretStore: Send + Sync {
    fn get(&self, key: &str) -> Result<String, CompanionError>;
    fn set(&self, key: &str, value: &str) -> Result<(), CompanionError>;
    fn delete(&self, key: &str) -> Result<(), CompanionError>;
}

#[derive(Default)]
pub struct OsSecretStore;

impl SecretStore for OsSecretStore {
    fn get(&self, key: &str) -> Result<String, CompanionError> {
        Entry::new(KEYRING_SERVICE, key)
            .map_err(|e| CompanionError::Credential(e.to_string()))?
            .get_password()
            .map_err(|e| CompanionError::Credential(e.to_string()))
    }

    fn set(&self, key: &str, value: &str) -> Result<(), CompanionError> {
        Entry::new(KEYRING_SERVICE, key)
            .map_err(|e| CompanionError::Credential(e.to_string()))?
            .set_password(value)
            .map_err(|e| CompanionError::Credential(e.to_string()))
    }

    fn delete(&self, key: &str) -> Result<(), CompanionError> {
        let entry = Entry::new(KEYRING_SERVICE, key)
            .map_err(|e| CompanionError::Credential(e.to_string()))?;
        match entry.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => Err(CompanionError::Credential(e.to_string())),
        }
    }
}

pub fn store_plaid_credentials(
    secrets: &dyn SecretStore,
    client_id: &str,
    secret: &str,
) -> Result<(), CompanionError> {
    if client_id.trim().is_empty() || secret.trim().is_empty() {
        return Err(CompanionError::Config(
            "Plaid client ID and secret must both be non-empty".into(),
        ));
    }
    secrets.set("plaid-client-id", client_id.trim())?;
    if let Err(error) = secrets.set("plaid-secret", secret.trim()) {
        // Do not leave a partially configured credential pair.
        let _ = secrets.delete("plaid-client-id");
        return Err(error);
    }
    Ok(())
}

pub(crate) fn plaid_credentials(
    secrets: &dyn SecretStore,
) -> Result<(String, String), CompanionError> {
    Ok((
        secrets.get("plaid-client-id")?,
        secrets.get("plaid-secret")?,
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{collections::HashMap, sync::Mutex};

    #[derive(Default)]
    struct MockSecrets(Mutex<HashMap<String, String>>);

    impl SecretStore for MockSecrets {
        fn get(&self, key: &str) -> Result<String, CompanionError> {
            self.0
                .lock()
                .unwrap()
                .get(key)
                .cloned()
                .ok_or_else(|| CompanionError::Credential("missing".into()))
        }
        fn set(&self, key: &str, value: &str) -> Result<(), CompanionError> {
            self.0.lock().unwrap().insert(key.into(), value.into());
            Ok(())
        }
        fn delete(&self, key: &str) -> Result<(), CompanionError> {
            self.0.lock().unwrap().remove(key);
            Ok(())
        }
    }

    #[test]
    fn plaid_credentials_live_in_secret_store() {
        let secrets = MockSecrets::default();
        store_plaid_credentials(&secrets, "client", "secret").unwrap();
        assert_eq!(
            plaid_credentials(&secrets).unwrap(),
            ("client".into(), "secret".into())
        );
    }
}
