import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "./button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error caught by ErrorBoundary:", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || "";
      const isChunkError = 
        errorMsg.includes("Failed to fetch dynamically imported module") ||
        errorMsg.includes("Importing a module script failed") ||
        errorMsg.includes("error loading dynamically imported module") ||
        errorMsg.toLowerCase().includes("chunk");

      return (
        <div className="flex min-h-[400px] w-full flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md space-y-6">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              {isChunkError ? "App Update Available" : "Something went wrong"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {isChunkError 
                ? "A new version of the app is available. Please reload to load the latest features."
                : "An unexpected error occurred. Please try reloading the page."}
            </p>
            <Button
              onClick={this.handleReload}
              variant="default"
              size="lg"
              className="rounded-xl px-6"
            >
              Reload Page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
