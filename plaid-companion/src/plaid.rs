use crate::store::{RemovedTransaction, TransactionChange};
use reqwest::Client;
use serde::Deserialize;
use serde_json::{json, Value};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum PlaidError {
    #[error("Plaid request failed: {0}")]
    Http(String),
    #[error("Plaid returned an invalid response: {0}")]
    Response(String),
}

#[derive(Clone)]
pub struct PlaidApi {
    client: Client,
    base: String,
    client_id: String,
    secret: String,
}

#[derive(Clone, Debug)]
pub struct ExchangeResult {
    pub item_id: String,
    pub access_token: String,
}

#[derive(Clone, Debug)]
pub struct LinkTokenResult {
    pub link_token: String,
    pub expiration: String,
}

#[derive(Clone, Debug, Default)]
pub struct TransactionChanges {
    pub added: Vec<TransactionChange>,
    pub modified: Vec<TransactionChange>,
    pub removed: Vec<RemovedTransaction>,
    pub next_cursor: String,
}

#[derive(Deserialize)]
struct SyncPage {
    #[serde(default)]
    added: Vec<Value>,
    #[serde(default)]
    modified: Vec<Value>,
    #[serde(default)]
    removed: Vec<Value>,
    next_cursor: String,
    has_more: bool,
}

impl PlaidApi {
    pub fn new(
        base: impl Into<String>,
        client_id: String,
        secret: String,
    ) -> Result<Self, PlaidError> {
        let client = Client::builder()
            .user_agent("Budgetzilla-Plaid-Companion/0.1")
            .build()
            .map_err(|e| PlaidError::Http(e.to_string()))?;
        Ok(Self {
            client,
            base: base.into().trim_end_matches('/').to_owned(),
            client_id,
            secret,
        })
    }

    async fn post(&self, path: &str, body: Value) -> Result<Value, PlaidError> {
        let response = self
            .client
            .post(format!("{}{path}", self.base))
            .header("Plaid-Version", "2020-09-14")
            .json(&body)
            .send()
            .await
            .map_err(|e| PlaidError::Http(e.to_string()))?;
        let status = response.status();
        let data: Value = response
            .json()
            .await
            .map_err(|e| PlaidError::Response(e.to_string()))?;
        if !status.is_success() {
            let code = data
                .get("error_code")
                .and_then(Value::as_str)
                .unwrap_or("UNKNOWN");
            let message = data
                .get("error_message")
                .and_then(Value::as_str)
                .unwrap_or("request rejected");
            return Err(PlaidError::Http(format!(
                "{code}: {message} (HTTP {})",
                status.as_u16()
            )));
        }
        Ok(data)
    }

    fn common(&self) -> Value {
        json!({"client_id": self.client_id, "secret": self.secret})
    }

    pub async fn create_link_token(
        &self,
        history_days: u16,
    ) -> Result<LinkTokenResult, PlaidError> {
        let mut body = self.common();
        body["user"] = json!({"client_user_id": uuid::Uuid::new_v4().to_string()});
        body["client_name"] = json!("Budgetzilla");
        body["products"] = json!(["transactions"]);
        body["transactions"] = json!({"days_requested": history_days});
        body["country_codes"] = json!(["US"]);
        body["language"] = json!("en");
        let response = self.post("/link/token/create", body).await?;
        let link_token = response
            .get("link_token")
            .and_then(Value::as_str)
            .map(str::to_owned)
            .ok_or_else(|| PlaidError::Response("missing link_token".into()))?;
        let expiration = response
            .get("expiration")
            .and_then(Value::as_str)
            .map(str::to_owned)
            .ok_or_else(|| PlaidError::Response("missing expiration".into()))?;
        Ok(LinkTokenResult {
            link_token,
            expiration,
        })
    }

    pub async fn exchange_public_token(
        &self,
        public_token: &str,
    ) -> Result<ExchangeResult, PlaidError> {
        let mut body = self.common();
        body["public_token"] = json!(public_token);
        let response = self.post("/item/public_token/exchange", body).await?;
        let item_id = response
            .get("item_id")
            .and_then(Value::as_str)
            .ok_or_else(|| PlaidError::Response("missing item_id".into()))?;
        let access_token = response
            .get("access_token")
            .and_then(Value::as_str)
            .ok_or_else(|| PlaidError::Response("missing access_token".into()))?;
        Ok(ExchangeResult {
            item_id: item_id.into(),
            access_token: access_token.into(),
        })
    }

    pub async fn get_item(&self, access_token: &str) -> Result<Value, PlaidError> {
        let mut body = self.common();
        body["access_token"] = json!(access_token);
        self.post("/item/get", body).await
    }

    pub async fn get_accounts(&self, access_token: &str) -> Result<Vec<Value>, PlaidError> {
        let mut body = self.common();
        body["access_token"] = json!(access_token);
        let response = self.post("/accounts/get", body).await?;
        response
            .get("accounts")
            .and_then(Value::as_array)
            .cloned()
            .ok_or_else(|| PlaidError::Response("missing accounts".into()))
    }

    pub async fn get_institution(
        &self,
        institution_id: &str,
    ) -> Result<Option<String>, PlaidError> {
        let mut body = self.common();
        body["institution_id"] = json!(institution_id);
        body["country_codes"] = json!(["US"]);
        let response = self.post("/institutions/get_by_id", body).await?;
        Ok(response
            .pointer("institution.name")
            .and_then(Value::as_str)
            .map(str::to_owned))
    }

    pub async fn remove_item(&self, access_token: &str) -> Result<(), PlaidError> {
        let mut body = self.common();
        body["access_token"] = json!(access_token);
        self.post("/item/remove", body).await?;
        Ok(())
    }

    async fn sync_once(
        &self,
        access_token: &str,
        start_cursor: Option<&str>,
    ) -> Result<TransactionChanges, PlaidError> {
        let mut cursor = start_cursor.map(str::to_owned);
        let mut changes = TransactionChanges::default();
        let mut page_count = 0usize;
        loop {
            page_count += 1;
            if page_count > 10_000 {
                return Err(PlaidError::Response(
                    "transactions pagination exceeded safety limit".into(),
                ));
            }
            let mut body = self.common();
            body["access_token"] = json!(access_token);
            body["count"] = json!(500);
            if let Some(value) = &cursor {
                body["cursor"] = json!(value);
            }
            let response = self.post("/transactions/sync", body).await?;
            let page: SyncPage = serde_json::from_value(response)
                .map_err(|e| PlaidError::Response(e.to_string()))?;
            changes.added.extend(
                page.added
                    .into_iter()
                    .map(normalize_transaction)
                    .collect::<Result<Vec<_>, _>>()?,
            );
            changes.modified.extend(
                page.modified
                    .into_iter()
                    .map(normalize_transaction)
                    .collect::<Result<Vec<_>, _>>()?,
            );
            changes.removed.extend(
                page.removed
                    .into_iter()
                    .map(normalize_removed)
                    .collect::<Result<Vec<_>, _>>()?,
            );
            changes.next_cursor = page.next_cursor.clone();
            cursor = Some(page.next_cursor);
            if !page.has_more {
                return Ok(changes);
            }
        }
    }

    /// Plaid requires a failed multi-page mutation loop to restart at its original cursor.
    pub async fn sync_transactions(
        &self,
        access_token: &str,
        cursor: Option<&str>,
    ) -> Result<TransactionChanges, PlaidError> {
        for attempt in 0..3 {
            match self.sync_once(access_token, cursor).await {
                Err(PlaidError::Http(message))
                    if message.contains("TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION")
                        && attempt < 2 =>
                {
                    continue
                }
                result => return result,
            }
        }
        unreachable!("bounded retry loop returns on its final attempt")
    }
}

fn normalize_transaction(value: Value) -> Result<TransactionChange, PlaidError> {
    let string = |key: &str| {
        value
            .get(key)
            .and_then(Value::as_str)
            .map(str::to_owned)
            .ok_or_else(|| PlaidError::Response(format!("transaction missing {key}")))
    };
    let amount = value
        .get("amount")
        .and_then(Value::as_f64)
        .ok_or_else(|| PlaidError::Response("transaction missing amount".into()))?;
    Ok(TransactionChange {
        transaction_id: string("transaction_id")?,
        account_id: string("account_id")?,
        date: string("date")?,
        authorized_date: value
            .get("authorized_date")
            .and_then(Value::as_str)
            .map(str::to_owned),
        // Plaid reports debits as positive; Budgetzilla stores expenses as negative.
        amount_cents: (-(amount * 100.0).round()) as i64,
        merchant: value
            .get("merchant_name")
            .and_then(Value::as_str)
            .or_else(|| value.get("name").and_then(Value::as_str))
            .map(str::to_owned),
        pending: value
            .get("pending")
            .and_then(Value::as_bool)
            .unwrap_or(false),
        pending_transaction_id: value
            .get("pending_transaction_id")
            .and_then(Value::as_str)
            .map(str::to_owned),
    })
}

fn normalize_removed(value: Value) -> Result<RemovedTransaction, PlaidError> {
    Ok(RemovedTransaction {
        transaction_id: value
            .get("transaction_id")
            .and_then(Value::as_str)
            .map(str::to_owned)
            .ok_or_else(|| {
                PlaidError::Response("removed transaction missing transaction_id".into())
            })?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use wiremock::{
        matchers::{method, path},
        Mock, MockServer, ResponseTemplate,
    };

    #[tokio::test]
    async fn sync_collects_pages_and_keeps_removals() {
        let server = MockServer::start().await;
        Mock::given(method("POST")).and(path("/transactions/sync"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "added":[{"transaction_id":"a","account_id":"acct","date":"2026-01-01","amount":10.25,"name":"Shop","pending":false}],"modified":[],"removed":[],"next_cursor":"c1","has_more":true
            }))).up_to_n_times(1).mount(&server).await;
        Mock::given(method("POST")).and(path("/transactions/sync"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "added":[],"modified":[{"transaction_id":"b","account_id":"acct","date":"2026-01-02","amount":-2.5,"name":"Refund","pending":true}],"removed":[{"transaction_id":"c"}],"next_cursor":"c2","has_more":false
            }))).mount(&server).await;
        let api = PlaidApi::new(server.uri(), "id".into(), "secret".into()).unwrap();
        let got = api.sync_transactions("access", None).await.unwrap();
        assert_eq!(got.added.len(), 1);
        assert_eq!(got.modified.len(), 1);
        assert_eq!(got.removed.len(), 1);
        assert_eq!(got.next_cursor, "c2");
    }

    #[tokio::test]
    async fn sync_restarts_from_original_cursor_after_pagination_mutation() {
        let server = MockServer::start().await;
        Mock::given(method("POST")).and(path("/transactions/sync"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "added":[{"transaction_id":"discarded","account_id":"acct","date":"2026-01-01","amount":1,"name":"discarded","pending":false}],"modified":[],"removed":[],"next_cursor":"bad-page","has_more":true
            }))).up_to_n_times(1).mount(&server).await;
        Mock::given(method("POST")).and(path("/transactions/sync"))
            .respond_with(ResponseTemplate::new(400).set_body_json(json!({
                "error_code":"TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION","error_message":"restart"
            }))).up_to_n_times(1).mount(&server).await;
        Mock::given(method("POST")).and(path("/transactions/sync"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "added":[{"transaction_id":"kept","account_id":"acct","date":"2026-01-01","amount":1,"name":"kept","pending":false}],"modified":[],"removed":[],"next_cursor":"final","has_more":false
            }))).mount(&server).await;
        let api = PlaidApi::new(server.uri(), "id".into(), "secret".into()).unwrap();
        let got = api
            .sync_transactions("access", Some("original"))
            .await
            .unwrap();
        assert_eq!(got.added.len(), 1);
        assert_eq!(got.added[0].transaction_id, "kept");
        assert_eq!(got.next_cursor, "final");
    }

    #[tokio::test]
    async fn link_and_exchange_use_backend_endpoints_and_return_only_expected_fields() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/link/token/create"))
            .respond_with(ResponseTemplate::new(200).set_body_json(
                json!({ "link_token":"link-sandbox-test", "expiration":"2026-10-27T00:00:00Z" }),
            ))
            .mount(&server)
            .await;
        Mock::given(method("POST"))
            .and(path("/item/public_token/exchange"))
            .respond_with(
                ResponseTemplate::new(200).set_body_json(
                    json!({ "item_id":"item-test", "access_token":"access-secret" }),
                ),
            )
            .mount(&server)
            .await;
        Mock::given(method("POST"))
            .and(path("/item/remove"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({ "request_id":"req" })))
            .mount(&server)
            .await;
        let api = PlaidApi::new(server.uri(), "client-id".into(), "client-secret".into()).unwrap();
        let link = api.create_link_token(90).await.unwrap();
        assert_eq!(link.link_token, "link-sandbox-test");
        assert_eq!(link.expiration, "2026-10-27T00:00:00Z");
        let exchanged = api.exchange_public_token("public-one-time").await.unwrap();
        assert_eq!(exchanged.item_id, "item-test");
        assert_eq!(exchanged.access_token, "access-secret");
        api.remove_item(&exchanged.access_token).await.unwrap();
    }

    #[test]
    fn normalizes_plaid_amounts_to_budgetzilla_cents_and_camel_case_shape() {
        let expense = normalize_transaction(json!({
            "transaction_id":"expense", "account_id":"account", "date":"2026-01-01",
            "amount":12.34, "name":"Coffee", "pending":false
        }))
        .unwrap();
        assert_eq!(expense.amount_cents, -1234);
        let income = normalize_transaction(json!({
            "transaction_id":"income", "account_id":"account", "date":"2026-01-02",
            "amount":-5.50, "name":"Refund", "pending":true,
            "pending_transaction_id":"pending"
        }))
        .unwrap();
        assert_eq!(income.amount_cents, 550);
        assert_eq!(income.pending_transaction_id.as_deref(), Some("pending"));
        let serialized = serde_json::to_value(income).unwrap();
        assert_eq!(serialized["transactionId"], "income");
        assert_eq!(serialized["amountCents"], 550);
        assert!(serialized.get("transaction_id").is_none());
    }
}
