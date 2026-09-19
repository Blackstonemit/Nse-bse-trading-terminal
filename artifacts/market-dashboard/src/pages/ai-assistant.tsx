import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Bot,
  Send,
  Plus,
  Trash2,
  Sparkles,
  Zap,
  TrendingUp,
  Target,
  Flame,
  Settings2,
  Loader2,
  User as UserIcon,
  CheckCircle2,
  RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

interface Conversation {
  id: number;
  title: string;
  createdAt: string;
}

interface Message {
  id?: number;
  role: "user" | "assistant";
  content: string;
  createdAt?: string;
}

const PRESET_PROMPTS = [
  {
    icon: Flame,
    title: "NIFTY & BankNifty Expiry Analysis",
    prompt: "Analyze NIFTY and BankNifty today. What is the current PCR, Max Pain strike, and are there any Gamma Blast setups?",
    color: "text-amber-400 border-amber-500/30 bg-amber-500/10",
  },
  {
    icon: Target,
    title: "Top Conviction Price Targets",
    prompt: "Which NSE stocks currently have the highest analyst conviction and upside potential (>25%)? Provide target prices and investment thesis.",
    color: "text-blue-400 border-blue-500/30 bg-blue-500/10",
  },
  {
    icon: Zap,
    title: "0DTE Options Scalping Strategy",
    prompt: "Suggest a 5-minute VWAP and momentum scalping setup for ATM options contracts on expiry day with strict stop-loss rules.",
    color: "text-cyan-400 border-cyan-500/30 bg-cyan-500/10",
  },
  {
    icon: TrendingUp,
    title: "Volume Breakout Scanner",
    prompt: "Identify stocks experiencing abnormal volume surges (>3x 20DMA) with high delivery percentage and bullish momentum.",
    color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
  },
];

export default function AiAssistantPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [inputText, setInputText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch all conversations
  const { data: convList = [], isLoading: isConvLoading } = useQuery<Conversation[]>({
    queryKey: ["conversations"],
    queryFn: async () => {
      const res = await fetch("/api/conversations");
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Select first conversation or null
  useEffect(() => {
    if (convList.length > 0 && activeConvId === null) {
      setActiveConvId(convList[0].id);
    }
  }, [convList, activeConvId]);

  // Fetch messages for active conversation
  const { data: messages = [], isLoading: isMsgLoading } = useQuery<Message[]>({
    queryKey: ["conversation-messages", activeConvId],
    queryFn: async () => {
      if (!activeConvId) return [];
      const res = await fetch(`/api/conversations/${activeConvId}/messages`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!activeConvId,
  });

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Create conversation mutation
  const createConvMutation = useMutation({
    mutationFn: async (title: string) => {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error("Failed to create chat");
      return res.json();
    },
    onSuccess: (newConv) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      setActiveConvId(newConv.id);
    },
  });

  // Delete conversation mutation
  const deleteConvMutation = useMutation({
    mutationFn: async (id: number) => {
      await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      setActiveConvId(null);
    },
  });

  // Send message mutation
  const sendMsgMutation = useMutation({
    mutationFn: async ({ convId, content }: { convId: number; content: string }) => {
      const res = await fetch(`/api/conversations/${convId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) throw new Error("Failed to send message");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["conversation-messages", activeConvId] });
      setInputText("");
    },
  });

  const handleSend = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text) return;

    let targetConvId: number;
    if (!activeConvId) {
      // Create new conversation first
      const title = text.slice(0, 30) + (text.length > 30 ? "..." : "");
      const newConv = await createConvMutation.mutateAsync(title);
      targetConvId = newConv.id;
    } else {
      targetConvId = activeConvId;
    }

    sendMsgMutation.mutate({ convId: targetConvId, content: text });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-[calc(100vh-8.5rem)] flex gap-4 animate-in fade-in duration-300">
      {/* Sidebar: Conversation History */}
      <div className="w-64 bg-slate-900/80 border border-slate-800 rounded-xl flex flex-col overflow-hidden hidden md:flex shrink-0">
        <div className="p-3 border-b border-slate-800 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
            <Bot className="w-3.5 h-3.5 text-cyan-400" />
            <span>Chat Sessions</span>
          </span>
          <button
            onClick={() => createConvMutation.mutate("New Analysis")}
            className="p-1 rounded bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 transition-colors cursor-pointer"
            title="New Conversation"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1 no-scrollbar">
          {isConvLoading ? (
            <div className="text-center py-6 text-slate-500 text-xs">Loading sessions...</div>
          ) : convList.length === 0 ? (
            <div className="text-center py-8 text-slate-500 text-xs px-2">
              No conversations yet. Start an analysis!
            </div>
          ) : (
            convList.map((conv) => (
              <div
                key={conv.id}
                onClick={() => setActiveConvId(conv.id)}
                className={cn(
                  "flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium cursor-pointer transition-all group",
                  activeConvId === conv.id
                    ? "bg-blue-600/20 text-blue-300 border border-blue-500/30"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                )}
              >
                <span className="truncate pr-2">{conv.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConvMutation.mutate(conv.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 transition-opacity"
                  title="Delete Chat"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Chat Interface */}
      <div className="flex-1 bg-slate-900/80 border border-slate-800 rounded-xl flex flex-col overflow-hidden shadow-lg">
        {/* Chat Header */}
        <div className="h-12 px-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-950/40">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-white text-xs block">AI Trading Assistant</span>
              <span className="text-[10px] text-slate-400">
                Multi-Provider Quantitative Reasoning Desk
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-slate-700/80 text-[10px] font-mono text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>FAILOVER CHAIN ACTIVE</span>
            </div>
            <Link
              href="/settings"
              className="p-1.5 rounded bg-slate-800 text-slate-400 hover:text-white transition-colors"
              title="Configure AI API Keys"
            >
              <Settings2 className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Message Thread Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
          {messages.length === 0 ? (
            <div className="max-w-2xl mx-auto py-8 text-center space-y-6">
              <div className="w-12 h-12 rounded-2xl bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mx-auto shadow-[0_0_20px_rgba(6,182,212,0.3)]">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">
                  How can I help with your trading analysis today?
                </h2>
                <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                  Ask about Nifty/BankNifty option chains, PCR, broker targets, breakout screeners, or customized risk-managed trading strategies.
                </p>
              </div>

              {/* Preset Query Chips */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-left pt-2">
                {PRESET_PROMPTS.map((item) => (
                  <button
                    key={item.title}
                    onClick={() => handleSend(item.prompt)}
                    className={cn(
                      "p-3 rounded-xl border transition-all text-left group hover:scale-[1.01] cursor-pointer",
                      item.color
                    )}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <item.icon className="w-4 h-4 shrink-0" />
                      <span className="font-semibold text-xs text-white group-hover:text-cyan-300">
                        {item.title}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 line-clamp-2 leading-tight">
                      {item.prompt}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={idx}
                  className={cn(
                    "flex gap-3 max-w-3xl",
                    isUser ? "ml-auto flex-row-reverse" : "mr-auto"
                  )}
                >
                  <div
                    className={cn(
                      "w-7 h-7 rounded-lg shrink-0 flex items-center justify-center text-xs font-bold",
                      isUser
                        ? "bg-blue-600 text-white"
                        : "bg-cyan-600/20 text-cyan-400 border border-cyan-500/30"
                    )}
                  >
                    {isUser ? (
                      user?.picture ? (
                        <img src={user.picture} alt="You" className="w-full h-full rounded-lg object-cover" />
                      ) : (
                        <UserIcon className="w-3.5 h-3.5" />
                      )
                    ) : (
                      <Bot className="w-3.5 h-3.5" />
                    )}
                  </div>

                  <div
                    className={cn(
                      "p-3.5 rounded-2xl text-xs leading-relaxed space-y-2 max-w-xl",
                      isUser
                        ? "bg-blue-600 text-white rounded-tr-none"
                        : "bg-slate-950/80 border border-slate-800 text-slate-200 rounded-tl-none font-sans"
                    )}
                  >
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                  </div>
                </div>
              );
            })
          )}

          {sendMsgMutation.isPending && (
            <div className="flex gap-3 mr-auto max-w-xl">
              <div className="w-7 h-7 rounded-lg bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Bot className="w-3.5 h-3.5 animate-pulse" />
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800 text-xs text-slate-400 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                <span>Running quantitative analysis and evaluating market feeds...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/60 shrink-0">
          <div className="relative flex items-center">
            <textarea
              rows={2}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask AI Copilot about any NSE/BSE stock, strategy, or indicator setup... (Press Enter to send)"
              className="w-full pl-3 pr-12 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500 resize-none font-sans"
            />
            <button
              onClick={() => handleSend()}
              disabled={sendMsgMutation.isPending || !inputText.trim()}
              className="absolute right-2.5 p-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:hover:bg-cyan-600 text-white transition-all cursor-pointer shadow-[0_0_10px_rgba(6,182,212,0.4)]"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
