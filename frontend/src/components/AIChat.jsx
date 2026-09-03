import { useEffect, useRef, useState } from "react";
import {
  Send, Sparkles, Bot, User, Trash2, BookOpen, ChevronDown,
  ChevronUp, CheckSquare, Square, SlidersHorizontal
} from "lucide-react";
import api from "../api/client";

const SESSION_KEY = "rutina_chat_history";
const DIARY_TOGGLE_KEY = "rutina_chat_include_diary";
const EXCLUDED_ENTRIES_KEY = "rutina_chat_excluded_entries";

function loadHistory() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(history) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(history));
  } catch {
    // sessionStorage lleno o no disponible — ignorar
  }
}

function formatDateShort(dateStr) {
  try {
    const [y, m, d] = dateStr.split("-");
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    return date.toLocaleDateString("es", { day: "numeric", month: "short" });
  } catch {
    return dateStr;
  }
}

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
        "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
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
  const [history, setHistory] = useState(() => loadHistory());
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef(null);

  // Estados de control de contexto del diario
  const [includeDiary, setIncludeDiary] = useState(() => {
    const saved = localStorage.getItem(DIARY_TOGGLE_KEY);
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [availableEntries, setAvailableEntries] = useState([]);
  const [selectedEntryIds, setSelectedEntryIds] = useState(new Set());
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [loadedEntries, setLoadedEntries] = useState(false);

  // Cargar entradas del diario para el selector
  useEffect(() => {
    async function fetchJournalEntries() {
      try {
        const res = await api.get("/journal");
        const entries = res.data?.entries || [];
        setAvailableEntries(entries);

        // Exclusiones previas guardadas
        let excluded = new Set();
        try {
          const rawExcluded = localStorage.getItem(EXCLUDED_ENTRIES_KEY);
          if (rawExcluded) excluded = new Set(JSON.parse(rawExcluded));
        } catch {
          // ignore
        }

        // Por defecto preseleccionamos las que no hayan sido excluidas previamente
        const initialSelected = new Set(
          entries.filter((e) => !excluded.has(e.id)).map((e) => e.id)
        );
        setSelectedEntryIds(initialSelected);
        setLoadedEntries(true);
      } catch (err) {
        console.warn("No se pudieron cargar las notas para el selector:", err);
      }
    }
    fetchJournalEntries();
  }, []);

  // Persistir configuración de diario
  useEffect(() => {
    localStorage.setItem(DIARY_TOGGLE_KEY, JSON.stringify(includeDiary));
  }, [includeDiary]);

  const toggleEntrySelection = (id) => {
    setSelectedEntryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      // Guardar lista de excluidos
      if (availableEntries.length > 0) {
        const excluded = availableEntries.filter((e) => !next.has(e.id)).map((e) => e.id);
        localStorage.setItem(EXCLUDED_ENTRIES_KEY, JSON.stringify(excluded));
      }
      return next;
    });
  };

  const selectAllEntries = () => {
    const all = new Set(availableEntries.map((e) => e.id));
    setSelectedEntryIds(all);
    localStorage.removeItem(EXCLUDED_ENTRIES_KEY);
  };

  const clearAllEntries = () => {
    setSelectedEntryIds(new Set());
    const allIds = availableEntries.map((e) => e.id);
    localStorage.setItem(EXCLUDED_ENTRIES_KEY, JSON.stringify(allIds));
  };

  // Persistir historial en sessionStorage cada vez que cambia
  useEffect(() => {
    saveHistory(history);
  }, [history]);

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
      const payload = {
        message: text,
        history: history, // historial previo (sin el mensaje actual)
        include_diary: includeDiary,
        // Si el diario está activo y hay notas cargadas, enviamos solo los IDs seleccionados
        selected_entry_ids: includeDiary && loadedEntries ? Array.from(selectedEntryIds) : null,
      };

      const res = await api.post("/journal/chat", payload);
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
    <div className="flex flex-col h-[560px] rounded-2xl border border-line bg-bg overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-line bg-panel px-4 py-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-soft text-violet">
          <Sparkles size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-ink">Coach IA</p>
            <span className={[
              "text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors",
              includeDiary && selectedEntryIds.size > 0
                ? "bg-violet-soft text-violet"
                : "bg-panel-alt text-ink-faint",
            ].join(" ")}>
              {includeDiary
                ? `${selectedEntryIds.size} ${selectedEntryIds.size === 1 ? "nota activa" : "notas activas"}`
                : "Diario desactivado"}
            </span>
          </div>
          <p className="text-xs text-ink-faint truncate">
            {includeDiary
              ? selectedEntryIds.size > 0
                ? "Responde considerando solo las notas que elegiste"
                : "Sin notas del diario seleccionadas"
              : "No se compartirá tu diario con la IA"}
          </p>
        </div>

        {/* Botón para abrir/cerrar el selector de notas */}
        <button
          onClick={() => setIsPanelOpen((o) => !o)}
          title="Elegir notas del diario a enviar"
          className={[
            "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer border",
            isPanelOpen
              ? "bg-panel-alt border-line text-ink"
              : "border-transparent text-ink-soft hover:bg-panel-alt hover:text-ink",
          ].join(" ")}
        >
          <BookOpen size={13} className={includeDiary ? "text-violet" : "text-ink-faint"} />
          <span className="hidden sm:inline">Notas</span>
          {isPanelOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>

        {history.length > 0 && (
          <button
            onClick={() => { setHistory([]); sessionStorage.removeItem(SESSION_KEY); }}
            title="Limpiar conversación"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-faint hover:bg-coral-soft hover:text-coral transition-colors cursor-pointer"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Panel colapsable de configuración de notas */}
      {isPanelOpen && (
        <div className="border-b border-line bg-panel-alt/70 px-4 py-3 text-xs flex flex-col gap-2.5 transition-all">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 cursor-pointer select-none font-medium text-ink">
              <input
                type="checkbox"
                checked={includeDiary}
                onChange={(e) => setIncludeDiary(e.target.checked)}
                className="rounded border-line text-violet focus:ring-violet"
              />
              <span>Compartir contexto de mi diario</span>
            </label>

            {includeDiary && availableEntries.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={selectAllEntries}
                  className="text-[11px] text-violet hover:underline cursor-pointer"
                >
                  Marcar todas
                </button>
                <span className="text-line">•</span>
                <button
                  onClick={clearAllEntries}
                  className="text-[11px] text-ink-faint hover:text-coral hover:underline cursor-pointer"
                >
                  Desmarcar todas
                </button>
              </div>
            )}
          </div>

          {includeDiary ? (
            availableEntries.length > 0 ? (
              <div className="max-h-36 overflow-y-auto rounded-xl border border-line bg-panel p-2 flex flex-col gap-1">
                {availableEntries.map((entry) => {
                  const isChecked = selectedEntryIds.has(entry.id);
                  return (
                    <div
                      key={entry.id}
                      onClick={() => toggleEntrySelection(entry.id)}
                      className={[
                        "flex items-start gap-2 rounded-lg p-1.5 transition-colors cursor-pointer select-none",
                        isChecked ? "hover:bg-violet-soft/20" : "opacity-60 hover:opacity-100 hover:bg-panel-alt",
                      ].join(" ")}
                    >
                      <button
                        type="button"
                        className="mt-0.5 shrink-0 text-violet"
                      >
                        {isChecked ? <CheckSquare size={14} /> : <Square size={14} className="text-ink-faint" />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] font-semibold text-ink">
                            {formatDateShort(entry.entry_date)}
                          </span>
                        </div>
                        <p className="line-clamp-1 text-[11px] text-ink-soft">
                          {entry.content}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[11px] text-ink-faint italic">
                Aún no tienes notas guardadas en tu diario.
              </p>
            )
          ) : (
            <p className="text-[11px] text-ink-faint">
              El diario está desactivado. El Coach responderá de forma neutral y libre de temas de tus notas previas.
            </p>
          )}
        </div>
      )}

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
                {includeDiary && selectedEntryIds.size > 0
                  ? "Conozco tus hábitos y las notas que has elegido compartir. Pregúntame lo que quieras."
                  : "Listo para ayudarte con tus hábitos y productividad diaria."}
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

