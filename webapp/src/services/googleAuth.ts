/**
 * Google Authentication service using Google Identity Services (GIS).
 * Handles browser-based OAuth for Google Drive access.
 */

// Google API types
declare namespace gapi {
  interface Client {
    init(config: { discoveryDocs: string[] }): Promise<void>;
    setToken(token: { access_token: string }): void;
    drive: {
      files: {
        list(params: Record<string, unknown>): { result: { files?: Array<{ id?: string; name?: string; md5Checksum?: string; modifiedTime?: string }> } };
        get(params: Record<string, unknown>): Promise<{ body: ArrayBuffer }>;
        update(params: Record<string, unknown>): Promise<{ result: { id: string } }>;
        create(params: Record<string, unknown>): Promise<{ result: { id: string } }>;
      };
    };
  }
  const client: Client;
  function load(api: string, callback: () => void): void;
}

// Google Identity Services types
declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: TokenClientConfig) => TokenClient;
          revoke: (token: string, callback?: () => void) => void;
        };
      };
    };
    gapi?: typeof gapi;
  }
}

interface TokenClientConfig {
  client_id: string;
  scope: string;
  callback: (response: TokenResponse) => void;
  error_callback?: (error: ErrorResponse) => void;
}

interface TokenClient {
  requestAccessToken: (options?: { prompt?: string }) => void;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
  error?: string;
  error_description?: string;
}

interface ErrorResponse {
  type: string;
  message?: string;
}

// Storage keys
const TOKEN_KEY = "google_access_token";
const TOKEN_EXPIRY_KEY = "google_token_expiry";

// Scopes - using appDataFolder for hidden app data
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";

// Discovery doc for Drive API
const DISCOVERY_DOC = "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest";

let tokenClient: TokenClient | null = null;
let gapiLoaded = false;
let gisLoaded = false;

/**
 * Load the Google API client library.
 */
export async function loadGapiClient(): Promise<void> {
  if (gapiLoaded) return;

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://apis.google.com/js/api.js";
    script.onload = () => {
      window.gapi!.load("client", async () => {
        try {
          await window.gapi!.client.init({
            discoveryDocs: [DISCOVERY_DOC],
          });
          gapiLoaded = true;
          resolve();
        } catch (err) {
          reject(err);
        }
      });
    };
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

/**
 * Load Google Identity Services library.
 */
export async function loadGisClient(): Promise<void> {
  if (gisLoaded) return;

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.onload = () => {
      gisLoaded = true;
      resolve();
    };
    script.onerror = reject;
    document.body.appendChild(script);
  });
}

/**
 * Initialize Google authentication.
 * Must be called before any other auth operations.
 */
export async function initGoogleAuth(clientId: string): Promise<void> {
  await Promise.all([loadGapiClient(), loadGisClient()]);

  return new Promise((resolve) => {
    tokenClient = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (response) => {
        if (response.access_token) {
          saveToken(response.access_token, response.expires_in);
        }
      },
      error_callback: (error) => {
        console.error("Google auth error:", error);
      },
    });
    resolve();
  });
}

/**
 * Request an access token via OAuth popup.
 * Returns a promise that resolves with the token or rejects on error/cancel.
 */
export function requestAccessToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error("Google auth not initialized. Call initGoogleAuth first."));
      return;
    }

    // Check for existing valid token
    const existing = getStoredToken();
    if (existing) {
      setGapiToken(existing);
      resolve(existing);
      return;
    }

    // Create a one-time callback
    const originalCallback = (window.google!.accounts.oauth2 as any)._tokenClient?.callback;
    
    tokenClient = window.google!.accounts.oauth2.initTokenClient({
      client_id: getClientId(),
      scope: DRIVE_SCOPE,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error));
          return;
        }
        if (response.access_token) {
          saveToken(response.access_token, response.expires_in);
          setGapiToken(response.access_token);
          resolve(response.access_token);
        }
      },
      error_callback: (error) => {
        reject(new Error(error.message || "Authentication failed"));
      },
    });

    tokenClient.requestAccessToken({ prompt: "" });
  });
}

/**
 * Request a new access token, forcing the consent screen.
 */
export function requestAccessTokenWithConsent(): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!tokenClient) {
      reject(new Error("Google auth not initialized. Call initGoogleAuth first."));
      return;
    }

    tokenClient = window.google!.accounts.oauth2.initTokenClient({
      client_id: getClientId(),
      scope: DRIVE_SCOPE,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error_description || response.error));
          return;
        }
        if (response.access_token) {
          saveToken(response.access_token, response.expires_in);
          setGapiToken(response.access_token);
          resolve(response.access_token);
        }
      },
      error_callback: (error) => {
        reject(new Error(error.message || "Authentication failed"));
      },
    });

    tokenClient.requestAccessToken({ prompt: "consent" });
  });
}

/**
 * Revoke the current access token and clear stored credentials.
 */
export function revokeToken(): Promise<void> {
  return new Promise((resolve) => {
    const token = getStoredToken();
    if (token) {
      window.google?.accounts.oauth2.revoke(token, () => {
        clearStoredToken();
        resolve();
      });
    } else {
      clearStoredToken();
      resolve();
    }
  });
}

/**
 * Check if we have a valid (non-expired) token.
 */
export function isAuthenticated(): boolean {
  return getStoredToken() !== null;
}

/**
 * Get the stored access token if valid.
 */
export function getStoredToken(): string | null {
  const token = localStorage.getItem(TOKEN_KEY);
  const expiry = localStorage.getItem(TOKEN_EXPIRY_KEY);

  if (!token || !expiry) return null;

  // Check if token is expired (with 5 minute buffer)
  const expiryTime = parseInt(expiry, 10);
  if (Date.now() > expiryTime - 5 * 60 * 1000) {
    clearStoredToken();
    return null;
  }

  return token;
}

/**
 * Save the access token and its expiry time.
 */
function saveToken(token: string, expiresIn: number): void {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(TOKEN_EXPIRY_KEY, String(Date.now() + expiresIn * 1000));
}

/**
 * Clear the stored token.
 */
function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_EXPIRY_KEY);
}

/**
 * Set the access token on the gapi client.
 */
function setGapiToken(token: string): void {
  if (window.gapi?.client) {
    window.gapi.client.setToken({ access_token: token });
  }
}

// Store client ID for later use
let storedClientId = "";

/**
 * Get the stored client ID.
 */
function getClientId(): string {
  return storedClientId;
}

/**
 * Store the client ID for use in token refresh.
 */
export function setClientId(clientId: string): void {
  storedClientId = clientId;
}

/**
 * Ensure we have a valid token, refreshing if needed.
 */
export async function ensureAuthenticated(): Promise<string> {
  const token = getStoredToken();
  if (token) {
    setGapiToken(token);
    return token;
  }
  return requestAccessToken();
}

/**
 * Get the gapi client for making Drive API calls.
 */
export function getGapiClient(): typeof gapi.client | null {
  return window.gapi?.client ?? null;
}

/**
 * Check if the Google libraries are loaded.
 */
export function isGoogleLoaded(): boolean {
  return gapiLoaded && gisLoaded;
}
