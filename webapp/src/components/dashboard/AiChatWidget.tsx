import React, { useState, useEffect, useRef } from "react";
import { MessageSquare, X, Send, Loader2, Bot, User, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { pingOllama, askLocalAi } from "@/services/localAiChat";
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
    // Check if Ollama is running on mount
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

    await askLocalAi(userText, (update) => {
      if (update.type === "progress") {
        setThinkingText(update.content);
      } else if (update.type === "chunk") {
        setThinkingText(""); // Hide thinking indicator once chunks start arriving
        setMessages(prev => {
          const existing = prev.find(m => m.id === tempAiId);
          if (existing) {
            return prev.map(m => m.id === tempAiId ? { ...m, content: existing.content + update.content } : m);
          }
          // First chunk, create the message
          return [...prev, { id: tempAiId, role: "ai", content: update.content }];
        });
      } else if (update.type === "error") {
        setMessages(prev => [
          ...prev,
          { id: `err-${Date.now()}`, role: "ai", content: update.content }
        ]);
      }
    });
    
    setIsLoading(false);
    setThinkingText("");
  };

  return (
    <>
      <svg width="0" height="0" className="absolute">
        <defs>
          <linearGradient id="ai-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" /> {/* blue-500 */}
            <stop offset="50%" stopColor="#6366f1" /> {/* indigo-500 */}
            <stop offset="100%" stopColor="#a855f7" /> {/* purple-500 */}
          </linearGradient>
        </defs>
      </svg>
      {/* Floating Button */}
      <div className={cn("fixed bottom-6 right-6 z-50 transition-all duration-300", isOpen && "opacity-0 scale-95 pointer-events-none")}>
        <Button 
          size="icon" 
          className="h-14 w-14 rounded-full shadow-lg hover:shadow-glow-accent hover:-translate-y-1 transition-all bg-card/80 backdrop-blur-lg border border-border/60 text-accent-foreground animate-pulse-slow"
          onClick={() => setIsOpen(true)}
        >
          <Sparkles className="h-7 w-7" color="url(#ai-gradient)" />
        </Button>
      </div>

      {/* Chat Window */}
      <div 
        className={cn(
          "fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-3rem)] h-[550px] max-h-[calc(100vh-6rem)] bg-card/95 backdrop-blur-xl border border-border/60 shadow-2xl rounded-2xl flex flex-col transition-all duration-300 origin-bottom-right",
          isOpen ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/60 bg-background/40 rounded-t-2xl">
          <div className="flex items-center gap-2 font-semibold">
            <Sparkles className="h-5 w-5" color="url(#ai-gradient)" />
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
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        </form>
      </div>
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
