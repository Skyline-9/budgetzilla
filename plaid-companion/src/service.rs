use crate::{
    config::AppConfig,
    plaid::PlaidApi,
    store::{self, now, PlaidAccount},
    CompanionError, Database, Item, PendingBatch, SecretStore,
};
use axum::{
    body::Body,
    extract::{Path, State},
    http::{header, HeaderMap, HeaderValue, Method, Request, StatusCode},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{delete, get, patch, post},
    Json, Router,
};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
use rand::{rngs::OsRng, RngCore};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::{
    sync::Arc,
    time::{Duration, Instant},
};
use tokio::sync::Mutex;
use tracing::error;
use url::Url;

pub struct AppState {
    pub(crate) config: AppConfig,
    pub(crate) database: Arc<Database>,
    secrets: Arc<dyn SecretStore>,
    pairing: Mutex<PairingCode>,
    expected_port: u16,
    plaid_base: String,
    sync_gate: Mutex<()>,
}

struct PairingCode {
    value: String,
    expires: Instant,
    consumed: bool,
}

#[derive(Serialize)]
struct ApiError {
    error: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PairRequest {
    pairing_code: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct PairResponse {
    session_token: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExchangeRequest {
    public_token: String,
    institution_id: Option<String>,
    institution_name: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AckRequest {
    batch_id: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct LinkTokenRequest {
    history_days: Option<u16>,
    products: Option<Vec<String>>,
}

#[derive(Deserialize)]
struct AccountEnabledRequest {
    enabled: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ItemSummary {
    item_id: String,
    institution_name: String,
    accounts: Vec<PlaidAccount>,
    status: String,
    last_sync_at: Option<String>,
    error_message: Option<String>,
}

impl AppState {
    pub fn new(
        config: AppConfig,
        database: Database,
        secrets: Arc<dyn SecretStore>,
        expected_port: u16,
    ) -> (Arc<Self>, String) {
        Self::with_plaid_base(config, database, secrets, expected_port, None)
    }

    pub fn with_plaid_base(
        config: AppConfig,
        database: Database,
        secrets: Arc<dyn SecretStore>,
        expected_port: u16,
        plaid_base: Option<String>,
    ) -> (Arc<Self>, String) {
        let mut bytes = [0u8; 32];
        OsRng.fill_bytes(&mut bytes);
        let code = URL_SAFE_NO_PAD.encode(bytes);
        let state = Arc::new(Self {
            plaid_base: plaid_base.unwrap_or_else(|| config.environment.api_base().to_owned()),
            config,
            database: Arc::new(database),
            secrets,
            pairing: Mutex::new(PairingCode {
                value: code.clone(),
                expires: Instant::now() + Duration::from_secs(300),
                consumed: false,
            }),
            expected_port,
            sync_gate: Mutex::new(()),
        });
        (state, code)
    }

    fn plaid(&self) -> Result<PlaidApi, CompanionError> {
        let (client_id, secret) = crate::plaid_credentials(self.secrets.as_ref())?;
        PlaidApi::new(self.plaid_base.clone(), client_id, secret)
            .map_err(|e| CompanionError::Config(e.to_string()))
    }
}

pub fn app(state: Arc<AppState>) -> Router {
    Router::new()
        .route("/v1/pair", post(pair))
        .route("/v1/health", get(health))
        .route("/v1/link-token", post(link_token))
        .route("/v1/items/exchange", post(exchange))
        .route("/v1/items", get(items))
        .route("/v1/items/:item_id", delete(remove_item))
        .route("/v1/items/:item_id/sync", post(sync_item))
        .route("/v1/items/:item_id/sync/ack", post(ack_item))
        .route("/v1/accounts/:account_id", patch(set_account_enabled))
        .fallback(not_found)
        .with_state(state.clone())
        .layer(middleware::from_fn_with_state(state, security_gate))
}

async fn security_gate(
    State(state): State<Arc<AppState>>,
    request: Request<Body>,
    next: Next,
) -> Response {
    let origin = match validated_origin(&state, request.headers()) {
        Some(origin) => origin,
        None => return api_error(StatusCode::FORBIDDEN, "origin or host rejected"),
    };
    let method = request.method().clone();
    if method == Method::OPTIONS {
        return preflight(&origin, request.headers());
    }
    if method != Method::GET
        && method != Method::POST
        && method != Method::DELETE
        && method != Method::PATCH
    {
        return api_error(StatusCode::METHOD_NOT_ALLOWED, "method not allowed");
    }
    let mut response = next.run(request).await;
    if let Ok(value) = HeaderValue::from_str(&origin) {
        response
            .headers_mut()
            .insert(header::ACCESS_CONTROL_ALLOW_ORIGIN, value);
        response
            .headers_mut()
            .insert(header::VARY, HeaderValue::from_static("Origin"));
        response
            .headers_mut()
            .insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    }
    response
}

fn validated_origin(state: &AppState, headers: &HeaderMap) -> Option<String> {
    let origin = headers.get(header::ORIGIN)?.to_str().ok()?;
    if !state
        .config
        .allowed_origins
        .iter()
        .any(|allowed| allowed == origin)
    {
        return None;
    }
    let host = headers.get(header::HOST)?.to_str().ok()?;
    let parsed_host = Url::parse(&format!("http://{host}")).ok()?;
    let authority_ok = matches!(parsed_host.host_str(), Some("127.0.0.1" | "localhost"))
        && parsed_host.username().is_empty()
        && parsed_host.password().is_none()
        && parsed_host.path() == "/"
        && parsed_host.query().is_none()
        && parsed_host.fragment().is_none()
        && parsed_host
            .port()
            .is_some_and(|port| state.expected_port == 0 || port == state.expected_port);
    if !authority_ok {
        return None;
    }
    Some(origin.to_owned())
}

fn preflight(origin: &str, headers: &HeaderMap) -> Response {
    let Some(method) = headers
        .get("access-control-request-method")
        .and_then(|v| v.to_str().ok())
    else {
        return api_error(StatusCode::BAD_REQUEST, "missing requested method");
    };
    if !matches!(method, "GET" | "POST" | "DELETE" | "PATCH") {
        return api_error(StatusCode::FORBIDDEN, "requested method rejected");
    }
    if let Some(requested) = headers
        .get("access-control-request-headers")
        .and_then(|v| v.to_str().ok())
    {
        if requested
            .split(',')
            .map(|h| h.trim().to_ascii_lowercase())
            .any(|h| !matches!(h.as_str(), "authorization" | "content-type"))
        {
            return api_error(StatusCode::FORBIDDEN, "requested header rejected");
        }
    }
    let mut response = StatusCode::NO_CONTENT.into_response();
    let headers = response.headers_mut();
    headers.insert(
        header::ACCESS_CONTROL_ALLOW_ORIGIN,
        HeaderValue::from_str(origin).unwrap(),
    );
    headers.insert(
        header::ACCESS_CONTROL_ALLOW_METHODS,
        HeaderValue::from_static("GET, POST, PATCH, DELETE, OPTIONS"),
    );
    headers.insert(
        header::ACCESS_CONTROL_ALLOW_HEADERS,
        HeaderValue::from_static("Authorization, Content-Type"),
    );
    headers.insert(
        header::ACCESS_CONTROL_MAX_AGE,
        HeaderValue::from_static("300"),
    );
    headers.insert(
        header::VARY,
        HeaderValue::from_static(
            "Origin, Access-Control-Request-Method, Access-Control-Request-Headers",
        ),
    );
    response
}

async fn pair(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(request): Json<PairRequest>,
) -> Response {
    let Some(origin) = validated_origin(&state, &headers) else {
        return api_error(StatusCode::FORBIDDEN, "origin rejected");
    };
    let mut code = state.pairing.lock().await;
    if code.consumed || Instant::now() > code.expires || request.pairing_code != code.value {
        return api_error(StatusCode::UNAUTHORIZED, "invalid or expired pairing code");
    }
    let token = random_secret();
    if let Err(error) = state.database.add_pair(&hash_secret(&token), &origin) {
        return internal(error);
    }
    code.consumed = true;
    Json(PairResponse {
        session_token: token,
    })
    .into_response()
}

async fn health(State(state): State<Arc<AppState>>) -> Response {
    match state.database.has_pairs() {
        Ok(paired) => Json(json!({ "status":"ready", "pairingRequired":!paired })).into_response(),
        Err(error) => internal(error),
    }
}

async fn link_token(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(request): Json<LinkTokenRequest>,
) -> Response {
    if let Err(response) = authorize(&state, &headers) {
        return response;
    }
    if request
        .products
        .as_ref()
        .is_some_and(|products| !products.iter().any(|p| p == "transactions"))
    {
        return api_error(
            StatusCode::BAD_REQUEST,
            "transactions is the only supported Plaid product",
        );
    }
    let history_days = request.history_days.unwrap_or(90);
    if !(1..=730).contains(&history_days) {
        return api_error(
            StatusCode::BAD_REQUEST,
            "historyDays must be between 1 and 730",
        );
    }
    let api = match state.plaid() {
        Ok(api) => api,
        Err(error) => return internal(error),
    };
    match api.create_link_token(history_days).await {
        Ok(result) => Json(json!({"linkToken":result.link_token,"expiration":result.expiration}))
            .into_response(),
        Err(error) => plaid_error(error),
    }
}

async fn exchange(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(request): Json<ExchangeRequest>,
) -> Response {
    if let Err(response) = authorize(&state, &headers) {
        return response;
    }
    if request.public_token.trim().is_empty() {
        return api_error(StatusCode::BAD_REQUEST, "publicToken is required");
    }
    let api = match state.plaid() {
        Ok(api) => api,
        Err(error) => return internal(error),
    };
    let exchange = match api.exchange_public_token(&request.public_token).await {
        Ok(result) => result,
        Err(error) => return plaid_error(error),
    };
    if let Err(error) = store::save_access_token(
        state.secrets.as_ref(),
        &exchange.item_id,
        &exchange.access_token,
    ) {
        return internal(error);
    }
    let item_data = api.get_item(&exchange.access_token).await.ok();
    let item_obj = item_data.as_ref().and_then(|v| v.get("item"));
    let institution_id = request.institution_id.or_else(|| {
        item_obj
            .and_then(|v| v.get("institution_id"))
            .and_then(Value::as_str)
            .map(str::to_owned)
    });
    let institution_name = match request
        .institution_name
        .filter(|name| !name.trim().is_empty())
    {
        Some(name) => name,
        None => match institution_id.as_deref() {
            Some(id) => api
                .get_institution(id)
                .await
                .ok()
                .flatten()
                .unwrap_or_else(|| "Linked institution".to_owned()),
            None => "Linked institution".to_owned(),
        },
    };
    let accounts_data = api
        .get_accounts(&exchange.access_token)
        .await
        .unwrap_or_default();
    let accounts: Vec<PlaidAccount> = accounts_data
        .iter()
        .filter_map(|account| {
            let account_id = account.get("account_id")?.as_str()?.to_owned();
            Some(PlaidAccount {
                account_id,
                item_id: Some(exchange.item_id.clone()),
                institution_name: Some(institution_name.clone()),
                name: account
                    .get("name")
                    .and_then(Value::as_str)
                    .unwrap_or("Account")
                    .to_owned(),
                mask: account
                    .get("mask")
                    .and_then(Value::as_str)
                    .map(str::to_owned),
                account_type: account
                    .get("type")
                    .and_then(Value::as_str)
                    .unwrap_or("unknown")
                    .to_owned(),
                subtype: account
                    .get("subtype")
                    .and_then(Value::as_str)
                    .map(str::to_owned),
                enabled: true,
            })
        })
        .collect();
    let error_data = item_obj
        .and_then(|item| item.get("error"))
        .filter(|v| !v.is_null());
    let plaid_error_code = error_data
        .and_then(|v| v.get("error_code"))
        .and_then(Value::as_str);
    let status = match plaid_error_code {
        None => "healthy",
        Some("ITEM_LOGIN_REQUIRED") => "reconnect_required",
        Some(_) => "error",
    };
    let last_sync_at = item_obj
        .and_then(|v| v.pointer("status.transactions.last_successful_update"))
        .and_then(Value::as_str)
        .map(str::to_owned);
    let error_message = error_data
        .and_then(|v| v.get("error_message"))
        .and_then(Value::as_str)
        .map(str::to_owned);
    let item = Item {
        item_id: exchange.item_id.clone(),
        institution_id,
        institution_name: institution_name.clone(),
        status: status.to_owned(),
        last_sync_at,
        error_message,
        created_at: now(),
    };
    if let Err(error) = state.database.add_item(&item) {
        let _ = store::delete_access_token(state.secrets.as_ref(), &exchange.item_id);
        return internal(error);
    }
    if let Err(error) = state.database.save_accounts(&accounts) {
        return internal(error);
    }
    Json(json!({"itemId":item.item_id,"institutionName":item.institution_name,"accounts":accounts}))
        .into_response()
}

async fn items(State(state): State<Arc<AppState>>, headers: HeaderMap) -> Response {
    if let Err(response) = authorize(&state, &headers) {
        return response;
    }
    match state.database.items() {
        Ok(items) => {
            let mut summaries = Vec::new();
            for item in items {
                let accounts = match state.database.accounts_for_item(&item.item_id) {
                    Ok(accounts) => accounts,
                    Err(error) => return internal(error),
                };
                summaries.push(ItemSummary {
                    item_id: item.item_id,
                    institution_name: item.institution_name,
                    accounts,
                    status: item.status,
                    last_sync_at: item.last_sync_at,
                    error_message: item.error_message,
                });
            }
            Json(json!({"items":summaries})).into_response()
        }
        Err(error) => internal(error),
    }
}

async fn remove_item(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(item_id): Path<String>,
) -> Response {
    if let Err(response) = authorize(&state, &headers) {
        return response;
    }
    let token = match store::access_token(state.secrets.as_ref(), &item_id) {
        Ok(token) => token,
        Err(error) => return internal(error),
    };
    let api = match state.plaid() {
        Ok(api) => api,
        Err(error) => return internal(error),
    };
    if let Err(error) = api.remove_item(&token).await {
        return plaid_error(error);
    }
    let secret_result = store::delete_access_token(state.secrets.as_ref(), &item_id);
    let db_result = state.database.remove_item(&item_id);
    if let Err(error) = secret_result {
        return internal(error);
    }
    match db_result {
        Ok(_) => Json(json!({"removed":true})).into_response(),
        Err(error) => internal(error),
    }
}

async fn sync_item(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(item_id): Path<String>,
) -> Response {
    if let Err(response) = authorize(&state, &headers) {
        return response;
    }
    let _gate = state.sync_gate.lock().await;
    match state.database.pending_batch(&item_id) {
        Ok(Some(batch)) => return Json(batch).into_response(),
        Ok(None) => {}
        Err(error) => return internal(error),
    }
    let cursor = match state.database.cursor(&item_id) {
        Ok(cursor) => cursor,
        Err(error) => return internal(error),
    };
    let token = match store::access_token(state.secrets.as_ref(), &item_id) {
        Ok(token) => token,
        Err(error) => return internal(error),
    };
    let api = match state.plaid() {
        Ok(api) => api,
        Err(error) => return internal(error),
    };
    let changes = match api.sync_transactions(&token, cursor.as_deref()).await {
        Ok(changes) => changes,
        Err(error) => return plaid_error(error),
    };
    let batch = PendingBatch {
        batch_id: uuid::Uuid::new_v4().to_string(),
        item_id: item_id.clone(),
        added: changes.added,
        modified: changes.modified,
        removed: changes.removed,
        completed_at: chrono::Utc::now().to_rfc3339(),
    };
    if let Err(error) = state.database.save_pending(&batch, &changes.next_cursor) {
        return internal(error);
    }
    Json(batch).into_response()
}

async fn ack_item(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(item_id): Path<String>,
    Json(request): Json<AckRequest>,
) -> Response {
    if let Err(response) = authorize(&state, &headers) {
        return response;
    }
    match state.database.acknowledge(&item_id, &request.batch_id) {
        Ok(true) => Json(json!({"committed":true})).into_response(),
        Ok(false) => api_error(StatusCode::CONFLICT, "no matching pending batch"),
        Err(error) => internal(error),
    }
}

async fn set_account_enabled(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(account_id): Path<String>,
    Json(request): Json<AccountEnabledRequest>,
) -> Response {
    if let Err(response) = authorize(&state, &headers) {
        return response;
    }
    match state
        .database
        .set_account_enabled(&account_id, request.enabled)
    {
        Ok(true) => Json(json!({"accountId":account_id,"enabled":request.enabled})).into_response(),
        Ok(false) => api_error(StatusCode::NOT_FOUND, "account not found"),
        Err(error) => internal(error),
    }
}

async fn not_found() -> Response {
    api_error(StatusCode::NOT_FOUND, "not found")
}

fn authorize(state: &AppState, headers: &HeaderMap) -> Result<String, Response> {
    let origin = validated_origin(state, headers)
        .ok_or_else(|| api_error(StatusCode::FORBIDDEN, "origin or host rejected"))?;
    let value = headers
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .unwrap_or_default();
    let Some(token) = value.strip_prefix("Bearer ") else {
        return Err(api_error(
            StatusCode::UNAUTHORIZED,
            "pairing token required",
        ));
    };
    let stored_origin = state
        .database
        .paired_origin(&hash_secret(token))
        .map_err(internal)?;
    if stored_origin.as_deref() != Some(origin.as_str()) {
        return Err(api_error(
            StatusCode::UNAUTHORIZED,
            "pairing token rejected",
        ));
    }
    Ok(origin)
}

fn random_secret() -> String {
    let mut bytes = [0u8; 32];
    OsRng.fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

fn hash_secret(secret: &str) -> String {
    hex::encode(Sha256::digest(secret.as_bytes()))
}

fn api_error(status: StatusCode, message: &str) -> Response {
    (
        status,
        Json(ApiError {
            error: message.into(),
        }),
    )
        .into_response()
}
fn internal(error: impl std::fmt::Display) -> Response {
    error!("companion request failed: {error}");
    api_error(
        StatusCode::INTERNAL_SERVER_ERROR,
        "companion request failed",
    )
}
fn plaid_error(error: impl std::fmt::Display) -> Response {
    error!("Plaid request failed: {error}");
    api_error(StatusCode::BAD_GATEWAY, "Plaid request failed")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{config::Environment, store::Database};
    use axum::body::to_bytes;
    use std::{collections::HashMap, path::PathBuf, sync::Mutex as StdMutex};
    use tower::ServiceExt;

    #[derive(Default)]
    struct Secrets(StdMutex<HashMap<String, String>>);
    impl SecretStore for Secrets {
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

    fn test_state() -> (Arc<AppState>, String, PathBuf) {
        let path =
            std::env::temp_dir().join(format!("plaid-companion-{}.sqlite", uuid::Uuid::new_v4()));
        let db = Database::open(&path).unwrap();
        let config = AppConfig::new(
            Environment::Sandbox,
            vec!["https://budgetzilla.test".into()],
        )
        .unwrap();
        let secrets = Arc::new(Secrets::default());
        let (state, code) =
            AppState::with_plaid_base(config, db, secrets, 0, Some("http://127.0.0.1:9".into()));
        (state, code, path)
    }

    #[tokio::test]
    async fn pairing_is_one_time_origin_bound_and_rejects_wrong_host() {
        let (state, code, path) = test_state();
        let router = app(state.clone());
        let response = router
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/pair")
                    .header(header::ORIGIN, "https://budgetzilla.test")
                    .header(header::HOST, "localhost:12345")
                    .header(header::CONTENT_TYPE, "application/json")
                    .body(Body::from(json!({"pairingCode":code}).to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::OK);
        let body = to_bytes(response.into_body(), usize::MAX).await.unwrap();
        let token = serde_json::from_slice::<Value>(&body).unwrap()["sessionToken"]
            .as_str()
            .unwrap()
            .to_owned();
        let wrong_host = router
            .clone()
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/v1/health")
                    .header(header::ORIGIN, "https://budgetzilla.test")
                    .header(header::HOST, "attacker.example:12345")
                    .header(header::AUTHORIZATION, format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(wrong_host.status(), StatusCode::FORBIDDEN);
        let second = router
            .clone()
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/v1/pair")
                    .header(header::ORIGIN, "https://budgetzilla.test")
                    .header(header::HOST, "127.0.0.1:12345")
                    .header(header::CONTENT_TYPE, "application/json")
                    .body(Body::from(json!({"pairingCode":code}).to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(second.status(), StatusCode::UNAUTHORIZED);
        let rejected = router
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri("/v1/health")
                    .header(header::ORIGIN, "https://evil.test")
                    .header(header::HOST, "127.0.0.1:12345")
                    .header(header::AUTHORIZATION, format!("Bearer {token}"))
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(rejected.status(), StatusCode::FORBIDDEN);
        let _ = std::fs::remove_file(path);
    }
}
