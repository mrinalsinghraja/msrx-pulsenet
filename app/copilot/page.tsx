"use client";

import { useState, useEffect, useRef } from "react";
import { Send, Loader2, Zap, User, Bot } from "lucide-react";
import ReactMarkdown from "react-markdown";

type Message = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Why is my internet slow right now?",
  "Is my network stable enough for video calls?",
  "What does my current latency mean?",
  "How can I improve my download speed?",
  "Explain my network health score",
  "Are there any anomalies I should worry about?",
];

type TestContext = {
  download?: number | null;
  upload?: number | null;
  latency?: number | null;
  jitter?: number | null;
  packetLoss?: number | null;
  score?: number | null;
};

function PulseNetLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <defs>
        <linearGradient id="cop-pn" x1="20" y1="10" x2="80" y2="90" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#60A5FA" />
          <stop offset="100%" stopColor="#A78BFA" />
        </linearGradient>
      </defs>
      <path d="M 88 62 A 40 40 0 1 1 88 38" stroke="url(#cop-pn)" strokeWidth="5" strokeLinecap="round" fill="none" />
      <circle cx="88" cy="38" r="5" fill="url(#cop-pn)" />
      <path d="M 40 62 A 10 10 0 0 0 60 62" stroke="url(#cop-pn)" strokeWidth="5.5" strokeLinecap="round" />
      <path d="M 32 62 A 18 18 0 0 0 68 62" stroke="url(#cop-pn)" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M 24 62 A 26 26 0 0 0 76 62" stroke="url(#cop-pn)" strokeWidth="4" strokeLinecap="round" />
      <circle cx="50" cy="62" r="5" fill="url(#cop-pn)" />
      <path d="M 50 67 L 50 78" stroke="url(#cop-pn)" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

export default function CopilotPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [context, setContext] = useState<TestContext | null>(null);
  const [noApiKey, setNoApiKey] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch("/api/tests?hours=24")
      .then((r) => r.json())
      .then((tests) => { if (tests[0]) setContext(tests[0]); });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    if (!text.trim() || streaming) return;
    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setStreaming(true);
    setNoApiKey(false);

    const allMessages = [...messages, userMsg];
    const assistantMsg: Message = { role: "assistant", content: "" };
    setMessages((prev) => [...prev, assistantMsg]);

    try {
      const res = await fetch("/api/ai/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: allMessages, context }),
      });

      if (res.status === 503) {
        setNoApiKey(true);
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: "assistant", content: "⚠️ GROQ_API_KEY not configured. Get a free key at console.groq.com, then add it to .env.local to use AI Copilot." },
        ]);
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") break;
          try {
            const { text } = JSON.parse(data);
            if (text) {
              full += text;
              setMessages((prev) => [
                ...prev.slice(0, -1),
                { role: "assistant", content: full },
              ]);
            }
          } catch { /* */ }
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: "assistant", content: "Network error. Try again." },
      ]);
    } finally {
      setStreaming(false);
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--border)] bg-white flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <PulseNetLogo size={22} />
          <div>
            <p className="font-semibold text-[15px] text-[var(--text-primary)]">PulseNet AI Copilot</p>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[11px] text-[var(--text-tertiary)]">
                {context ? "Network data loaded" : "Waiting for test data"}
              </span>
            </div>
          </div>
        </div>
        {context && (
          <div className="text-[11px] text-[var(--text-tertiary)] text-right">
            <p>{context.download?.toFixed(1)}↓ {context.upload?.toFixed(1)}↑ Mbps</p>
            <p>Latency {context.latency?.toFixed(0)}ms · Score {context.score}/100</p>
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center py-10">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-50 to-violet-50 border border-violet-100 flex items-center justify-center mb-4">
              <PulseNetLogo size={32} />
            </div>
            <p className="text-[16px] font-semibold text-[var(--text-primary)] mb-1">Ask me anything about your network</p>
            <p className="text-[13px] text-[var(--text-secondary)] mb-6 text-center max-w-xs">
              I can explain metrics, diagnose issues, and suggest optimizations.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-lg">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-left px-4 py-2.5 rounded-xl border border-[var(--border)] text-[13px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] hover:bg-white transition-all bg-white"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "assistant" && (
              <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-blue-50 to-violet-50 border border-violet-100 flex items-center justify-center shrink-0 mt-0.5">
                <Bot size={13} className="text-violet-500" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed ${
                m.role === "user"
                  ? "bg-gradient-to-r from-blue-500 to-violet-500 text-white rounded-tr-md"
                  : "bg-white border border-[var(--border)] text-[var(--text-primary)] rounded-tl-md"
              }`}
              style={m.role === "assistant" ? { boxShadow: "var(--shadow-card)" } : {}}
            >
              {m.role === "assistant" ? (
                m.content ? (
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                      strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                      h3: ({ children }) => <p className="font-semibold text-[14px] mt-3 mb-1 first:mt-0">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc pl-4 space-y-0.5 my-1">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal pl-4 space-y-0.5 my-1">{children}</ol>,
                      li: ({ children }) => <li className="text-[13px]">{children}</li>,
                      code: ({ children }) => <code className="bg-[var(--surface)] px-1 rounded text-[12px] font-mono">{children}</code>,
                    }}
                  >
                    {m.content}
                  </ReactMarkdown>
                ) : streaming && i === messages.length - 1 ? (
                  <Loader2 size={14} className="animate-spin text-[var(--text-tertiary)]" />
                ) : null
              ) : (
                m.content
              )}
            </div>
            {m.role === "user" && (
              <div className="w-7 h-7 rounded-xl bg-[var(--surface)] flex items-center justify-center shrink-0 mt-0.5">
                <User size={12} className="text-[var(--text-secondary)]" />
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-6 py-4 border-t border-[var(--border)] bg-white">
        {!context && (
          <div className="mb-3 flex items-center gap-2 text-[12px] text-amber-600">
            <Zap size={12} />
            <span>Run a speed test first for personalized insights.</span>
          </div>
        )}
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask about your network…"
            rows={1}
            className="flex-1 resize-none px-4 py-3 rounded-xl border border-[var(--border-strong)] text-[14px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition-all bg-[var(--surface)] min-h-[44px] max-h-[120px]"
            style={{ fieldSizing: "content" } as React.CSSProperties}
          />
          <button
            onClick={() => send(input)}
            disabled={!input.trim() || streaming}
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-all disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, #60a5fa, #a78bfa)" }}
          >
            {streaming ? (
              <Loader2 size={15} className="animate-spin text-white" />
            ) : (
              <Send size={15} className="text-white" />
            )}
          </button>
        </div>
        <p className="text-[11px] text-[var(--text-tertiary)] mt-2">Powered by Groq · Enter to send · Shift+Enter for new line</p>
      </div>
    </div>
  );
}
