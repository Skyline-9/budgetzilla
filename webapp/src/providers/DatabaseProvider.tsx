/**
 * Database Provider - Initializes SQLite WASM on app startup.
 * Only active when API_MODE is "local".
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { API_MODE, GOOGLE_CLIENT_ID } from "@/api/config";
import { initDatabase, isDatabaseReady } from "@/db/sqlite";
import { runMigrations } from "@/db/schema";
import { setDriveService } from "@/api/local/client";
import { createDriveService, initGoogleAuth, setClientId } from "@/services";

interface DatabaseContextValue {
  isReady: boolean;
  error: Error | null;
}

const DatabaseContext = createContext<DatabaseContextValue>({
  isReady: false,
  error: null,
});

export function useDatabaseStatus() {
  return useContext(DatabaseContext);
}

interface DatabaseProviderProps {
  children: ReactNode;
}

export function DatabaseProvider({ children }: DatabaseProviderProps) {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Only initialize database in local mode
    if (API_MODE !== "local") {
      setIsReady(true);
      return;
    }

    async function init() {
      try {
        // Initialize SQLite database
        await initDatabase();
        
        // Run migrations
        await runMigrations();

        // Initialize Google Auth if client ID is configured
        if (GOOGLE_CLIENT_ID) {
          setClientId(GOOGLE_CLIENT_ID);
          try {
            await initGoogleAuth(GOOGLE_CLIENT_ID);
            // Set up drive service for local API client
            setDriveService(createDriveService());
          } catch (authErr) {
            console.warn("Google Auth initialization failed:", authErr);
            // Non-fatal - app can work without Drive sync
          }
        }

        setIsReady(true);
      } catch (err) {
        console.error("Database initialization failed:", err);
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    }

    init();
  }, []);

  // Show loading state while initializing in local mode
  if (API_MODE === "local" && !isReady && !error) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading database...</p>
        </div>
      </div>
    );
  }

  // Show error state if initialization failed
  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center max-w-md p-6">
          <div className="text-destructive text-4xl mb-4">⚠️</div>
          <h1 className="text-xl font-semibold mb-2">Database Error</h1>
          <p className="text-muted-foreground mb-4">
            Failed to initialize the local database. This might be caused by browser storage restrictions.
          </p>
          <pre className="bg-muted p-3 rounded text-xs text-left overflow-auto max-h-32">
            {error.message}
          </pre>
          <button
            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <DatabaseContext.Provider value={{ isReady, error }}>
      {children}
    </DatabaseContext.Provider>
  );
}
