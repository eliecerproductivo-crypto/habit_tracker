import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, Bot, User } from "lucide-react";
import api from "../api/client";

function Message({ role, content }) {
  const isUser = role === "user";
  return (
    <div className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}>
      <div className={[
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs",
        isUser ? "bg-ink text-bg" : "bg-violet-soft text-violet",
      ].join(" ")}>
        {isUser ? <User size={13} /> : <Bot size={13} />}
      </div>
      <div className={[
        "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
        isUser
          ? "rounded-tr-sm bg-ink text-bg"
          : "rounded-tl-sm bg-panel border border-line text-ink",
      ].join(" ")}>
        {content}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-2.5">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-soft text-violet">
        <Bot size={13} />
      </div>
      <div className="rounded-2xl rounded-tl-sm border border-line bg-panel px-4 py-3">
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-ink-faint animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

const SUGGESTIONS = [
  "¿Por qué siento que no soy productivo últimamente?",
  "¿Qué patrón ves en mis hábitos esta semana?",
  "¿Qué me recomiendas mejorar?",
  "¿Cómo puedo mantener la racha?",
];

export default function AIChat() {
  const [history, setHistory] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, loading]);

  const send = async (message) => {
    const text = message || input.trim();
    if (!text || loading) return;
    setInput("");
    setError("");

    const newHistory = [...history, { role: "user", content: text }];
    setHistory(newHistory);
    setLoading(true);

    try {
      const res = await api.post("/journal/chat", {
        message: text,
        history: history, // historial previo (sin el mensaje actual)
      });
      setHistory([...newHistory, { role: "assistant", content: res.data.reply }]);
    } catch (err) {
      setError(err?.response?.data?.detail || "La IA no está disponible. Intenta de nuevo.");
      // Quitar el mensaje del usuario si falló
      setHistory(history);
    } finally {
      setLoading(false);
    }
  };

  const isEmpty = history.length === 0;

  return (
    <div className="flex flex-col h-[520px] rounded-2xl border border-line bg-bg overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-line bg-panel px-4 py-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-soft text-violet">
          <Sparkles size={14} />
        </div>
        <div>
          <p className="text-sm font-semibold text-ink">Coach IA</p>
          <p className="text-xs text-ink-faint">Basado en tu diario de los últimos 7 días</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {isEmpty && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-soft text-violet">
              <Sparkles size={22} />
            </div>
            <div>
              <p className="text-sm font-medium text-ink">Hola, soy tu coach personal</p>
              <p className="text-xs text-ink-soft mt-1 max-w-xs">
                Conozco tu diario reciente. Pregúntame lo que quieras sobre tus hábitos y productividad.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center mt-1">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="rounded-full border border-line bg-panel px-3 py-1.5 text-xs text-ink-soft hover:border-violet hover:text-violet transition-colors cursor-pointer"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {history.map((msg, i) => (
          <Message key={i} role={msg.role} content={msg.content} />
        ))}

        {loading && <TypingIndicator />}

        {error && (
          <p className="rounded-lg bg-coral-soft px-3 py-2 text-xs text-coral text-center">{error}</p>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-line bg-panel p-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Escribe tu pregunta…"
            maxLength={1000}
            className="flex-1 rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-signal"
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink text-bg transition-opacity hover:opacity-80 disabled:opacity-40 cursor-pointer"
          >
            <Send size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}
