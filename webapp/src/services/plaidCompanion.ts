import type { PlaidItemSummary, PlaidSyncBatch } from "@/types/plaid";
import { invoke } from "@tauri-apps/api/core";

type Health = { status: "ready"; pairingRequired: boolean };
type LinkToken = { linkToken: string; expiration: string };
type ExchangeMetadata = { institution?: { institution_id?: string; name?: string } };
type ExchangeResult = { itemId: string; institutionName: string; accounts: Array<{ accountId: string; name: string; mask?: string; type: string; subtype?: string; enabled: boolean }> };

const DEFAULT_COMPANION_URL = "http://127.0.0.1:43127";
const URL_KEY = "budgetzilla.plaidCompanionUrl";
const SESSION_KEY = "budgetzilla.plaidSessionToken";

function sessionValue(key: string): string | null {
  try { return typeof window === "undefined" ? null : window.sessionStorage.getItem(key); }
  catch { return null; }
}

function saveSessionValue(key: string, value: string): void {
  try { if (typeof window !== "undefined") window.sessionStorage.setItem(key, value); }
  catch { /* Companion remains usable for the current page session. */ }
}

let companionUrl = sessionValue(URL_KEY) ?? DEFAULT_COMPANION_URL;
let sessionToken: string | null = sessionValue(SESSION_KEY);
let desktopStartup: Promise<void> | null = null;

export function hasPlaidCompanionSession(): boolean { return sessionToken !== null; }

export function configurePlaidCompanion(url: string) {
  const parsed = new URL(url);
  if (!(["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname))) throw new Error("Companion must use a loopback address");
  const nextUrl = parsed.origin;
  if (nextUrl !== companionUrl) {
    sessionToken = null;
    try { window.sessionStorage.removeItem(SESSION_KEY); } catch { /* Storage is optional. */ }
  }
  companionUrl = nextUrl;
  saveSessionValue(URL_KEY, companionUrl);
}

export function startDesktopPlaidCompanion(): Promise<void> {
  if (!desktopStartup) {
    desktopStartup = (async () => {
      const status = await invoke<{ port: number; pairingCode: string }>("start_plaid_companion");
      configurePlaidCompanion(`http://127.0.0.1:${status.port}`);
      await plaidCompanion.pair(status.pairingCode);
    })().catch((error) => { desktopStartup = null; throw error; });
  }
  return desktopStartup;
}

function classify(error: unknown): Error {
  if (error instanceof TypeError) return new Error("Could not reach the Plaid companion. Start it locally and allow Budgetzilla to access your local network.");
  return error instanceof Error ? error : new Error("Plaid companion request failed");
}

async function request<T>(path: string, init: RequestInit = {}, auth = true): Promise<T> {
  if (auth && !sessionToken) throw new Error("Pair Budgetzilla with the Plaid companion first");
  let response: Response;
  try {
    response = await fetch(`${companionUrl}/v1${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(auth ? { Authorization: `Bearer ${sessionToken}` } : {}), ...init.headers },
      credentials: "omit",
    });
  } catch (error) { throw classify(error); }
  if (!response.ok) {
    let detail = `Plaid companion returned ${response.status}`;
    try { const body = await response.json(); if (typeof body.error === "string") detail = body.error; } catch { /* no response body */ }
    throw new Error(detail);
  }
  return response.json() as Promise<T>;
}

export const plaidCompanion = {
  health: () => request<Health>("/health", {}, false),
  async pair(code: string) {
    const result = await request<{ sessionToken: string }>("/pair", { method: "POST", body: JSON.stringify({ pairingCode: code }) }, false);
    sessionToken = result.sessionToken;
    saveSessionValue(SESSION_KEY, sessionToken);
    return result;
  },
  createLinkToken: (historyDays: number) => request<LinkToken>("/link-token", { method: "POST", body: JSON.stringify({ products: ["transactions"], historyDays }) }),
  exchangePublicToken: (publicToken: string, metadata: ExchangeMetadata) => request<ExchangeResult>("/items/exchange", { method: "POST", body: JSON.stringify({ publicToken, institutionId: metadata.institution?.institution_id, institutionName: metadata.institution?.name }) }),
  async listItems() { return (await request<{ items: PlaidItemSummary[] }>("/items")).items; },
  syncItem: (itemId: string) => request<PlaidSyncBatch>(`/items/${encodeURIComponent(itemId)}/sync`, { method: "POST" }),
  ackSyncBatch: (itemId: string, batchId: string) => request<{ committed: true }>(`/items/${encodeURIComponent(itemId)}/sync/ack`, { method: "POST", body: JSON.stringify({ batchId }) }),
  setAccountEnabled: (accountId: string, enabled: boolean) => request(`/accounts/${encodeURIComponent(accountId)}`, { method: "PATCH", body: JSON.stringify({ enabled }) }),
  removeItem: (itemId: string) => request<{ removed: true }>(`/items/${encodeURIComponent(itemId)}`, { method: "DELETE" }),
};
