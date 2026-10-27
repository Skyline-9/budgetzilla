use plaid_companion::{
    app, store_plaid_credentials, AppConfig, Database, Environment, OsSecretStore, SecretStore,
};
use clap::{Parser, Subcommand, ValueEnum};
use std::{net::SocketAddr, path::PathBuf, sync::Arc};
use tracing_subscriber::EnvFilter;

#[derive(Parser)]
#[command(
    name = "plaid-companion",
    version,
    about = "Local Plaid companion for Budgetzilla"
)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// Store Plaid credentials in the OS credential manager and configure browser origins.
    Configure {
        #[arg(long, value_enum, default_value = "sandbox")]
        environment: EnvironmentArg,
        #[arg(long = "origin", required = true, action = clap::ArgAction::Append)]
        origins: Vec<String>,
    },
    /// Print configuration and local Item status without exposing any credentials.
    Status,
    /// Start the IPv4 loopback service and print a short-lived pairing code.
    Serve {
        #[arg(long, default_value_t = 0)]
        port: u16,
        /// Use the one-line startup protocol consumed by the Tauri desktop launcher.
        #[arg(long, hide = true)]
        ipc: bool,
    },
}

#[derive(Clone, Copy, ValueEnum)]
enum EnvironmentArg {
    Sandbox,
    Development,
    Production,
}

impl From<EnvironmentArg> for Environment {
    fn from(value: EnvironmentArg) -> Self {
        match value {
            EnvironmentArg::Sandbox => Self::Sandbox,
            EnvironmentArg::Development => Self::Development,
            EnvironmentArg::Production => Self::Production,
        }
    }
}

fn paths() -> Result<(PathBuf, PathBuf), Box<dyn std::error::Error>> {
    let dir = plaid_companion::default_data_dir()?;
    Ok((dir.join("config.json"), dir.join("companion.sqlite")))
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("warn")),
        )
        .init();
    let cli = Cli::parse();
    let secrets: Arc<dyn SecretStore> = Arc::new(OsSecretStore);
    let (config_path, db_path) = paths()?;

    match cli.command {
        Command::Configure {
            environment,
            origins,
        } => {
            let config = AppConfig::new(environment.into(), origins)?;
            let client_id = rpassword::prompt_password("Plaid client ID: ")?;
            let secret = rpassword::prompt_password("Plaid secret: ")?;
            store_plaid_credentials(secrets.as_ref(), &client_id, &secret)?;
            config.save(&config_path)?;
            println!("Configured {:?} with {} exact origin(s). Credentials are stored in the OS credential manager.", config.environment, config.allowed_origins.len());
        }
        Command::Status => {
            let config = AppConfig::load(&config_path)?;
            let db = Database::open(&db_path)?;
            let credentials_present =
                secrets.get("plaid-client-id").is_ok() && secrets.get("plaid-secret").is_ok();
            println!("environment: {:?}", config.environment);
            println!("allowed origins: {}", config.allowed_origins.join(", "));
            println!(
                "Plaid credentials: {}",
                if credentials_present {
                    "available"
                } else {
                    "missing or OS credential manager unavailable"
                }
            );
            println!("linked Items: {}", db.item_count()?);
            println!("paired browsers: {}", db.has_pairs()?);
            if !credentials_present {
                std::process::exit(2);
            }
        }
        Command::Serve { port, ipc } => {
            let config = AppConfig::load(&config_path)?;
            // Check credentials before binding so keychain failure never falls back to disk.
            secrets.get("plaid-client-id")?;
            secrets.get("plaid-secret")?;
            let listener =
                tokio::net::TcpListener::bind(SocketAddr::from(([127, 0, 0, 1], port))).await?;
            let addr = listener.local_addr()?;
            let db = Database::open(&db_path)?;
            let (state, pairing_code) =
                plaid_companion::AppState::new(config, db, secrets, addr.port());
            if ipc {
                println!(
                    "{{\"port\":{},\"pairingCode\":{}}}",
                    addr.port(),
                    serde_json::to_string(&pairing_code)?
                );
                eprintln!("Plaid companion ready on IPv4 loopback. Pairing code expires in 5 minutes.");
            } else {
                println!("Plaid companion listening at http://127.0.0.1:{}", addr.port());
                println!("One-time pairing code (expires in 5 minutes): {pairing_code}");
                eprintln!("Pair only from a configured origin. Press Ctrl-C to stop.");
            }
            axum::serve(listener, app(state))
                .with_graceful_shutdown(async {
                    let _ = tokio::signal::ctrl_c().await;
                })
                .await?;
        }
    }
    Ok(())
}
