import React, { useState, useEffect } from "react";
import { Stars } from "lucide-react"; // Changed Sparkles to Stars
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

export function AiThinkingIndicator({ isVisible }: { isVisible: boolean }) {
  const [currentWord, setCurrentWord] = useState(THINKING_WORDS[0]);

  useEffect(() => {
    if (isVisible) {
      const interval = setInterval(() => {
        setCurrentWord(prev => {
          const currentIndex = THINKING_WORDS.indexOf(prev);
          const nextIndex = (currentIndex + 1) % THINKING_WORDS.length;
          return THINKING_WORDS[nextIndex];
        });
      }, 2000);
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
          className="flex items-center justify-start gap-2 p-3 bg-muted/40 border border-border/50 rounded-2xl w-fit"
        >
          <svg width="0" height="0" className="absolute">
            <defs>
              <linearGradient id="ai-gradient-thinking" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="50%" stopColor="#6366f1" />
                <stop offset="100%" stopColor="#a855f7" />
              </linearGradient>
            </defs>
          </svg>
          <Stars className="h-4 w-4 animate-spin-slow" fill="url(#ai-gradient-thinking)" stroke="url(#ai-gradient-thinking)" strokeWidth={0.5} /> {/* Changed to Stars */}
          <div className="text-xs font-medium text-muted-foreground overflow-hidden h-4 relative w-48">
            <AnimatePresence mode="wait">
              <motion.span
                key={currentWord}
                initial={{ y: 15, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -15, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0"
              >
                {currentWord}
              </motion.span>
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
