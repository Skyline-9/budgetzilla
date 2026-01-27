import React, { createContext, useCallback, useContext, useState } from "react";

type AnnounceOptions = {
  message: string;
  politeness?: "polite" | "assertive";
};

type AnnouncerContextValue = {
  announce: (options: AnnounceOptions) => void;
};

const AnnouncerContext = createContext<AnnouncerContextValue | null>(null);

export function useScreenReaderAnnounce() {
  const ctx = useContext(AnnouncerContext);
  if (!ctx) {
    throw new Error("useScreenReaderAnnounce must be used within ScreenReaderAnnouncerProvider");
  }
  return ctx.announce;
}

export function ScreenReaderAnnouncerProvider({ children }: { children: React.ReactNode }) {
  const [politeMessage, setPoliteMessage] = useState("");
  const [assertiveMessage, setAssertiveMessage] = useState("");

  const announce = useCallback(({ message, politeness = "polite" }: AnnounceOptions) => {
    if (politeness === "assertive") {
      setAssertiveMessage("");
      // Force re-render by clearing first
      setTimeout(() => setAssertiveMessage(message), 50);
    } else {
      setPoliteMessage("");
      setTimeout(() => setPoliteMessage(message), 50);
    }
  }, []);

  return (
    <AnnouncerContext.Provider value={{ announce }}>
      {children}
      {/* Polite announcements - for non-urgent updates */}
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {politeMessage}
      </div>
      {/* Assertive announcements - for urgent/error messages */}
      <div
        role="alert"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      >
        {assertiveMessage}
      </div>
    </AnnouncerContext.Provider>
  );
}
