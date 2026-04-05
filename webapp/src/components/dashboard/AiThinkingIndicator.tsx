import React, { useState, useEffect } from "react";
import { Sparkles } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/cn";

const THINKING_WORDS = [
  "Ideating...",
  "Consulting database...",
  "Generating SQL...",
  "Analyzing results...",
  "Querying transactions...",
  "Formatting insights...",
  "Cross-referencing categories...",
  "Compiling response...",
];

export function AiThinkingIndicator({ text, isVisible }: { text: string; isVisible: boolean }) {
  const [currentWord, setCurrentWord] = useState(THINKING_WORDS[0]);

  useEffect(() => {
    if (isVisible) {
      const interval = setInterval(() => {
        setCurrentWord(prev => {
          const currentIndex = THINKING_WORDS.indexOf(prev);
          const nextIndex = (currentIndex + 1) % THINKING_WORDS.length;
          return THINKING_WORDS[nextIndex];
        });
      }, 1500);
      return () => clearInterval(interval);
    }
  }, [isVisible]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 5 }}
          transition={{ duration: 0.2 }}
          className="flex items-center justify-start gap-2 p-3 bg-muted/40 border border-border/50 rounded-2xl"
        >
          <Sparkles className="h-4 w-4 text-accent animate-spin-slow" />
          <div className="text-xs text-muted-foreground overflow-hidden h-4 relative w-48">
            <AnimatePresence>
              <motion.span
                key={text || currentWord}
                initial={{ y: "100%", opacity: 0 }}
                animate={{ y: "0%", opacity: 1 }}
                exit={{ y: "-100%", opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="absolute inset-0"
              >
                {text || currentWord}
              </motion.span>
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
