use crate::CompanionError;
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
};
use url::Url;

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Environment {
    Sandbox,
    Development,
    Production,
}

impl Environment {
    pub fn api_base(self) -> &'static str {
        match self {
            Self::Sandbox => "https://sandbox.plaid.com",
            Self::Development => "https://development.plaid.com",
            Self::Production => "https://production.plaid.com",
        }
    }
}

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct AppConfig {
    pub environment: Environment,
    pub allowed_origins: Vec<String>,
}

impl AppConfig {
    pub fn new(environment: Environment, origins: Vec<String>) -> Result<Self, CompanionError> {
        let mut canonical = Vec::new();
        for origin in origins {
            let origin = origin.trim();
            let parsed = Url::parse(origin)
                .map_err(|e| CompanionError::Config(format!("invalid origin {origin:?}: {e}")))?;
            let is_tauri = parsed.scheme() == "tauri"
                && parsed.host_str() == Some("localhost")
                && parsed.port().is_none()
                && origin == "tauri://localhost";
            let is_web = matches!(parsed.scheme(), "https" | "http") && parsed.host_str().is_some();
            if (!is_web && !is_tauri)
                || parsed.username() != ""
                || parsed.password().is_some()
                || (!is_tauri && parsed.path() != "/")
                || (is_tauri && !parsed.path().is_empty() && parsed.path() != "/")
                || parsed.query().is_some()
                || parsed.fragment().is_some()
            {
                return Err(CompanionError::Config(format!(
                    "origin must be an exact HTTP(S) origin or tauri://localhost: {origin}"
                )));
            }
            let value = if is_tauri {
                "tauri://localhost".to_owned()
            } else {
                parsed.origin().ascii_serialization()
            };
            if !canonical.contains(&value) {
                canonical.push(value);
            }
        }
        if canonical.is_empty() {
            return Err(CompanionError::Config(
                "at least one exact browser origin is required".into(),
            ));
        }
        Ok(Self {
            environment,
            allowed_origins: canonical,
        })
    }

    pub fn load(path: &Path) -> Result<Self, CompanionError> {
        let bytes = fs::read(path)?;
        serde_json::from_slice(&bytes).map_err(|e| CompanionError::Config(e.to_string()))
    }

    pub fn save(&self, path: &Path) -> Result<(), CompanionError> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
            set_private_dir(parent)?;
        }
        let bytes =
            serde_json::to_vec_pretty(self).map_err(|e| CompanionError::Config(e.to_string()))?;
        let temporary = path.with_extension("json.tmp");
        fs::write(&temporary, bytes)?;
        set_private_file(&temporary)?;
        fs::rename(temporary, path)?;
        Ok(())
    }
}

pub fn default_data_dir() -> Result<PathBuf, CompanionError> {
    let base = dirs::data_local_dir().ok_or_else(|| {
        CompanionError::Config("OS application data directory unavailable".into())
    })?;
    Ok(base.join("Budgetzilla").join("PlaidCompanion"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exact_tauri_and_web_origins_are_allowed_but_tauri_wildcards_are_not() {
        let config = AppConfig::new(
            Environment::Sandbox,
            vec![
                "tauri://localhost".into(),
                "http://tauri.localhost".into(),
                "https://budgetzilla.example".into(),
            ],
        )
        .unwrap();
        assert_eq!(
            config.allowed_origins,
            [
                "tauri://localhost",
                "http://tauri.localhost",
                "https://budgetzilla.example"
            ]
        );
        assert!(AppConfig::new(Environment::Sandbox, vec!["tauri://other-host".into()]).is_err());
        assert!(AppConfig::new(
            Environment::Sandbox,
            vec!["https://budgetzilla.example/path".into()]
        )
        .is_err());
    }
}

#[cfg(unix)]
fn set_private_dir(path: &Path) -> Result<(), CompanionError> {
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(path, fs::Permissions::from_mode(0o700))?;
    Ok(())
}
#[cfg(not(unix))]
fn set_private_dir(_: &Path) -> Result<(), CompanionError> {
    Ok(())
}

#[cfg(unix)]
fn set_private_file(path: &Path) -> Result<(), CompanionError> {
    use std::os::unix::fs::PermissionsExt;
    fs::set_permissions(path, fs::Permissions::from_mode(0o600))?;
    Ok(())
}
#[cfg(not(unix))]
fn set_private_file(_: &Path) -> Result<(), CompanionError> {
    Ok(())
}
