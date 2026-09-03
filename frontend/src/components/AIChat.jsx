import { useEffect, useRef, useState } from "react";
import {
  Send, Sparkles, Bot, User, Trash2, BookOpen, ChevronDown,
  ChevronUp, CheckSquare, Square, ArrowDown,
} from "lucide-react";
import api from "../api/client";

const SESSION_KEY           = "rutina_chat_history";
const DIARY_TOGGLE_KEY      = "rutina_chat_include_diary";
const HABIT_NOTES_TOGGLE_KEY= "rutina_chat_include_habit_notes";
const EXCLUDED_ENTRIES_KEY  = "rutina_chat_excluded_entries";

function loadHistory() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function saveHistory(h) {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(h)); } catch {}
}
function formatDateShort(dateStr) {
  try {
    const [y, m, d] = dateStr.split("-");
    return new Date(+y, +m - 1, +d).toLocaleDateString("es", { day: "numeric", month: "short" });
  } catch { return dateStr; }
}

// ── Burbuja de mensaje ────────────────────────────────────────────────────────
function Message({ role, content }) {
  const isUser = role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      <div className={[
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs mt-0.5",
        isUser ? "bg-ink text-bg" : "bg-violet-soft text-violet",
      ].join(" ")}>
        {isUser ? <User size={13} /> : <Bot size={13} />}
      </div>
      <div className={[
        "max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
        isUser
          ? "rounded-tr-sm bg-ink text-bg"
          : "rounded-tl-sm bg-panel-alt border border-line text-ink",
      ].join(" ")}>
        {content}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-soft text-violet mt-0.5">
        <Bot size={13} />
      </div>
      <div className="rounded-2xl rounded-tl-sm border border-line bg-panel-alt px-4 py-3">
        <div className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-1.5 w-1.5 rounded-full bg-ink-faint animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

const SUGGESTIONS = [
  "¿Qué patrón ves en mis hábitos esta semana?",
  "¿Por qué siento que no soy productivo?",
  "¿Qué me recomiendas mejorar?",
  "¿Cómo puedo mantener la racha?",
];

// ── Componente principal ──────────────────────────────────────────────────────
export default function AIChat() {
  const [history, setHistory]   = useState(() => loadHistory());
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [atBottom, setAtBottom] = useState(true);
  const bottomRef   = useRef(null);
  const scrollRef   = useRef(null);
  const textareaRef = useRef(null);

  const [includeDiary, setIncludeDiary] = useState(() => {
    const s = localStorage.getItem(DIARY_TOGGLE_KEY);
    return s !== null ? JSON.parse(s) : true;
  });
  const [includeHabitNotes, setIncludeHabitNotes] = useState(() => {
    const s = localStorage.getItem(HABIT_NOTES_TOGGLE_KEY);
    return s !== null ? JSON.parse(s) : true;
  });
  const [availableEntries, setAvailableEntries]   = useState([]);
  const [selectedEntryIds, setSelectedEntryIds]   = useState(new Set());
  const [isPanelOpen, setIsPanelOpen]             = useState(false);
  const [loadedEntries, setLoadedEntries]         = useState(false);

  // Cargar entradas del diario
  useEffect(() => {
    api.get("/journal").then((res) => {
      const entries = res.data?.entries || [];
      setAvailableEntries(entries);
      let excluded = new Set();
      try {
        const raw = localStorage.getItem(EXCLUDED_ENTRIES_KEY);
        if (raw) excluded = new Set(JSON.parse(raw));
      } catch {}
      setSelectedEntryIds(new Set(entries.filter((e) => !excluded.has(e.id)).map((e) => e.id)));
      setLoadedEntries(true);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    localStorage.setItem(DIARY_TOGGLE_KEY, JSON.stringify(includeDiary));
  }, [includeDiary]);
  useEffect(() => {
    localStorage.setItem(HABIT_NOTES_TOGGLE_KEY, JSON.stringify(includeHabitNotes));
  }, [includeHabitNotes]);
  useEffect(() => { saveHistory(history); }, [history]);

  // Auto-scroll al fondo cuando llegan mensajes nuevos
  useEffect(() => {
    if (atBottom) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, loading, atBottom]);

  // Detectar si el usuario está al fondo del scroll
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 60);
  };

  // Auto-resize del textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [input]);

  const toggleEntry = (id) => {
    setSelectedEntryIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      const excluded = availableEntries.filter((e) => !next.has(e.id)).map((e) => e.id);
      localStorage.setItem(EXCLUDED_ENTRIES_KEY, JSON.stringify(excluded));
      return next;
    });
  };

  const send = async (message) => {
    const text = (message || input).trim();
    if (!text || loading) return;
    setInput("");
    setError("");
    setAtBottom(true);

    const newHistory = [...history, { role: "user", content: text }];
    setHistory(newHistory);
    setLoading(true);

    try {
      const res = await api.post("/journal/chat", {
        message: text,
        history,
        include_diary: includeDiary,
        selected_entry_ids: includeDiary && loadedEntries ? Array.from(selectedEntryIds) : null,
        include_habit_notes: includeHabitNotes,
      });
      setHistory([...newHistory, { role: "assistant", content: res.data.reply }]);
    } catch (err) {
      setError(err?.response?.data?.detail || "La IA no está disponible. Intenta de nuevo.");
      setHistory(history);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const isEmpty = history.length === 0;

  return (
    // Ocupa todo el espacio que el padre (main en AppShell) le da
    <div className="flex flex-1 flex-col overflow-hidden">

      {/* ── Topbar del chat ── */}
      <div className="shrink-0 flex items-center gap-2 border-b border-line bg-panel px-4 py-2.5">
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-soft text-violet">
          <Sparkles size={14} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-ink">Coach IA</p>
            <span className={[
              "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
              includeDiary && selectedEntryIds.size > 0
                ? "bg-violet-soft text-violet"
                : "bg-panel-alt text-ink-faint",
            ].join(" ")}>
              {includeDiary
                ? `${selectedEntryIds.size} ${selectedEntryIds.size === 1 ? "nota" : "notas"}`
                : "sin diario"}
            </span>
          </div>
        </div>

        {/* Botón selector de notas */}
        <button
          onClick={() => setIsPanelOpen((o) => !o)}
          className={[
            "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer border",
            isPanelOpen
              ? "bg-panel-alt border-line text-ink"
              : "border-transparent text-ink-soft hover:bg-panel-alt hover:text-ink",
          ].join(" ")}
        >
          <BookOpen size={13} className={includeDiary ? "text-violet" : "text-ink-faint"} />
          <span className="hidden sm:inline">Notas</span>
          {isPanelOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
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

      {/* ── Panel de configuración de notas (colapsable) ── */}
      {isPanelOpen && (
        <div className="shrink-0 border-b border-line bg-panel-alt/70 px-4 py-3 text-xs flex flex-col gap-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="flex items-center gap-2 cursor-pointer select-none font-medium text-ink">
              <input type="checkbox" checked={includeDiary}
                onChange={(e) => setIncludeDiary(e.target.checked)}
                className="rounded border-line text-violet focus:ring-violet" />
              Compartir contexto de mi diario
            </label>
            {includeDiary && availableEntries.length > 0 && (
              <div className="flex items-center gap-2">
                <button onClick={() => setSelectedEntryIds(new Set(availableEntries.map((e) => e.id)))}
                  className="text-[11px] text-violet hover:underline cursor-pointer">
                  Marcar todas
                </button>
                <span className="text-line">·</span>
                <button onClick={() => { setSelectedEntryIds(new Set()); localStorage.setItem(EXCLUDED_ENTRIES_KEY, JSON.stringify(availableEntries.map((e) => e.id))); }}
                  className="text-[11px] text-ink-faint hover:text-coral hover:underline cursor-pointer">
                  Desmarcar todas
                </button>
              </div>
            )}
          </div>

          {includeDiary && (
            availableEntries.length > 0 ? (
              <div className="max-h-32 overflow-y-auto rounded-xl border border-line bg-panel p-2 flex flex-col gap-1">
                {availableEntries.map((entry) => {
                  const checked = selectedEntryIds.has(entry.id);
                  return (
                    <div key={entry.id} onClick={() => toggleEntry(entry.id)}
                      className={[
                        "flex items-start gap-2 rounded-lg p-1.5 cursor-pointer select-none transition-colors",
                        checked ? "hover:bg-violet-soft/20" : "opacity-60 hover:opacity-100 hover:bg-panel-alt",
                      ].join(" ")}>
                      <span className="mt-0.5 shrink-0 text-violet">
                        {checked ? <CheckSquare size={13} /> : <Square size={13} className="text-ink-faint" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="font-mono text-[11px] font-semibold text-ink">
                          {formatDateShort(entry.entry_date)}
                        </span>
                        <p className="line-clamp-1 text-[11px] text-ink-soft">{entry.content}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-[11px] text-ink-faint italic">Aún no tienes notas en tu diario.</p>
            )
          )}

          <div className="border-t border-line/60 pt-2 flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer select-none font-medium text-ink">
              <input type="checkbox" checked={includeHabitNotes}
                onChange={(e) => setIncludeHabitNotes(e.target.checked)}
                className="rounded border-line text-signal focus:ring-signal" />
              Compartir notas y estados de ánimo de mis hábitos
            </label>
          </div>
        </div>
      )}

      {/* ── Área de mensajes (scroll interno) ── */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-4"
      >
        {isEmpty && (
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-violet-soft text-violet">
              <Sparkles size={26} />
            </div>
            <div>
              <p className="text-base font-semibold text-ink">Hola, soy tu coach personal</p>
              <p className="mt-1 text-sm text-ink-soft max-w-xs mx-auto">
                {includeDiary && selectedEntryIds.size > 0
                  ? "Conozco tus hábitos y las notas que elegiste. Pregúntame lo que quieras."
                  : "Listo para ayudarte con tus hábitos y productividad."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center mt-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)}
                  className="rounded-full border border-line bg-panel px-3 py-1.5 text-xs text-ink-soft hover:border-violet hover:text-violet transition-colors cursor-pointer">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {history.map((msg, i) => <Message key={i} role={msg.role} content={msg.content} />)}
        {loading && <TypingIndicator />}
        {error && (
          <p className="rounded-xl bg-coral-soft px-4 py-2.5 text-sm text-coral text-center">{error}</p>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Botón "bajar al fondo" */}
      {!atBottom && (
        <button
          onClick={() => { setAtBottom(true); bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }}
          className="absolute bottom-20 right-6 flex h-8 w-8 items-center justify-center rounded-full border border-line bg-panel shadow-md text-ink-soft hover:text-ink transition-colors cursor-pointer"
        >
          <ArrowDown size={15} />
        </button>
      )}

      {/* ── Input pegado al fondo ── */}
      <div className="shrink-0 border-t border-line bg-panel px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-2xl items-end gap-2">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Escribe tu pregunta… (Enter para enviar)"
            maxLength={1000}
            className="flex-1 resize-none overflow-hidden rounded-2xl border border-line bg-bg px-4 py-2.5 text-sm text-ink outline-none focus:border-signal placeholder:text-ink-faint leading-relaxed"
            style={{ minHeight: "42px" }}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-2xl bg-ink text-bg transition-opacity hover:opacity-80 disabled:opacity-35 cursor-pointer"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
