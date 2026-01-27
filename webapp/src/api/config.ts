export type ApiMode = "mock" | "local";

// Determine API mode:
// - "local" (default): Uses SQLite WASM with local storage
// - "mock": Uses in-memory mock data
function getApiMode(): ApiMode {
  const env = import.meta.env.VITE_API_MODE;
  if (env === "mock") return "mock";
  return "local"; // Default to local mode (frontend-only)
}

export const API_MODE: ApiMode = getApiMode();

// Google OAuth Client ID for Drive sync (frontend-only)
// Set via VITE_GOOGLE_CLIENT_ID environment variable
export const GOOGLE_CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";






