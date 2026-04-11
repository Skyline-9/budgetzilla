import React, { useState, useEffect, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MessageSquare, X, Loader2, Bot, User } from "lucide-react";
import { SparklesIcon } from "@/components/ui/sparkles";
import { SendIcon } from "@/components/ui/send";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { pingOllama, askLocalAi } from "@/services/localAiChat";
import { isWebGpuAvailable } from "@/services/webgpuInference";
import { AiThinkingIndicator } from "./AiThinkingIndicator";

interface ChatMessage {
  id: string;
  role: "user" | "ai";
  content: string;
}

export function AiChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [thinkingText, setThinkingText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isWebGpuAvailable()) {
      setIsAvailable(true);
      return;
    }
    pingOllama().then(available => setIsAvailable(available));
  }, []);

  useEffect(() => {
    // Scroll to bottom when messages change
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  if (!isAvailable) return null;

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userText = input.trim();
    setInput("");
    const tempUserId = `user-${Date.now()}`;
    const tempAiId = `ai-${Date.now()}`; // Use now() for better uniqueness

    setMessages(prev => [
      ...prev,
      { id: tempUserId, role: "user", content: userText },
    ]);
    setIsLoading(true);
    setThinkingText("Preparing to think...");

    try {
      await askLocalAi(userText, (update) => {
        if (update.type === "progress") {
          setThinkingText(update.content);
        } else if (update.type === "chunk") {
          setThinkingText("");
          setMessages(prev => {
            const existing = prev.find(m => m.id === tempAiId);
            if (existing) {
              return prev.map(m => m.id === tempAiId ? { ...m, content: existing.content + update.content } : m);
            }
            return [...prev, { id: tempAiId, role: "ai", content: update.content }];
          });
        } else if (update.type === "error") {
          setMessages(prev => [
            ...prev,
            { id: `err-${Date.now()}`, role: "ai", content: update.content }
          ]);
        }
      });
    } catch (e) {
      console.error("Chat error:", e);
      setMessages(prev => [
        ...prev,
        { id: `err-${Date.now()}`, role: "ai", content: "Something went wrong. Please try again." }
      ]);
    } finally {
      setIsLoading(false);
      setThinkingText("");
    }
  };

  return (
    <>
      {/* Floating Button */}
      <div className={cn("fixed bottom-6 right-6 z-50 transition-all duration-300", isOpen && "opacity-0 scale-95 pointer-events-none")}>
        <Button 
          size="icon" 
          aria-label="Open AI chat"
          className="h-14 w-14 rounded-full shadow-lg hover:shadow-glow-accent hover:-translate-y-1 transition-all bg-card/80 backdrop-blur-lg border border-border/60 text-accent-foreground animate-pulse-slow"
          onClick={() => setIsOpen(true)}
        >
          <SparklesIcon size={28} className="text-violet-400" />
        </Button>
      </div>

      {/* Chat Window */}
      <AnimatePresence>
      {isOpen && (
      <motion.div
        initial={{ opacity: 0, scale: 0.85, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.85, y: 20 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        style={{ transformOrigin: "bottom right" }}
        className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-3rem)] h-[550px] max-h-[calc(100vh-6rem)] bg-card/95 backdrop-blur-xl border border-border/60 shadow-2xl rounded-2xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-background/40 rounded-t-2xl">
          <div className="flex items-center gap-2 font-semibold">
            <SparklesIcon size={20} className="text-violet-400" />
            Financial Assistant
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setIsOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground text-center space-y-3 opacity-70">
              <Bot className="h-10 w-10" />
              <p className="text-sm">Ask me anything about your finances! I can query your data locally and answer questions.</p>
              <div className="flex flex-wrap justify-center gap-2 mt-4">
                <BadgeBtn onClick={() => setInput("How much did I spend this month?")}>Spend this month?</BadgeBtn>
                <BadgeBtn onClick={() => setInput("What are my top 3 expenses?")}>Top 3 expenses?</BadgeBtn>
                <BadgeBtn onClick={() => setInput("How much did I spend on groceries?")}>Grocery spend?</BadgeBtn>
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={cn("flex w-full", msg.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm",
                  msg.role === "user" 
                    ? "bg-primary text-primary-foreground rounded-br-sm" 
                    : "bg-muted/50 border border-border/50 text-foreground rounded-bl-sm [&_strong]:font-bold [&_ul]:list-disc [&_ul]:ml-4 [&_ol]:list-decimal [&_ol]:ml-4 [&_p]:mb-2 last:[&_p]:mb-0"
                )}>
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>
            ))
          )}
          
          <AiThinkingIndicator isVisible={isLoading && thinkingText.length > 0} />
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="p-3 border-t border-border/60 bg-background/40 rounded-b-2xl">
          <div className="relative flex items-center">
            <Input 
              placeholder="Ask about your finances..." 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              className="pr-12 rounded-xl bg-background/50 border-border/60 focus-visible:ring-accent/30"
            />
            <Button 
              type="submit" 
              size="icon" 
              variant="ghost" 
              disabled={!input.trim() || isLoading}
              className="absolute right-1 h-8 w-8 text-accent hover:text-accent/80 hover:bg-accent/10"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendIcon size={16} />}
            </Button>
          </div>
        </form>
      </motion.div>
      )}
      </AnimatePresence>
    </>
  );
}

function BadgeBtn({ children, onClick }: { children: React.ReactNode, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className="text-[11px] bg-background/50 border border-border/50 rounded-full px-3 py-1.5 hover:bg-accent/10 hover:text-accent transition-colors"
    >
      {children}
    </button>
  );
}
