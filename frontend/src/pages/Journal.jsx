import { useState, useEffect } from "react";
import { Sparkles, ChevronDown, ChevronUp, Trash2, BookOpen } from "lucide-react";
import { useJournal } from "../hooks/useJournal";
import { todayLocalISODate } from "../lib/schedule";

function formatDate(dateStr) {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("es", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

// ── Editor de la entrada de hoy ────────────────────────────────────────────────
function TodayEditor({ getEntry, saveEntry, deleteEntry, loading }) {
  const today = todayLocalISODate();
  const existing = getEntry(today);
  const [text, setText] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // Sincronizar cuando llega la entrada desde la BD (el fetch puede tardar)
  useEffect(() => {
    if (!loading && !initialized) {
      setText(existing?.content || "");
      setInitialized(true);
    }
  }, [loading, initialized, existing?.content]);

  const handleSave = async () => {
    if (!text.trim()) return;
    setSaving(true);
    setError("");
    try {
      await saveEntry(text.trim(), today);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err?.response?.data?.detail || "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    await deleteEntry(today);
    setText("");
  };

  return (
    <div className="rounded-2xl border border-line bg-panel p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-ink">Reflexión de hoy</h2>
          <p className="text-xs text-ink-faint mt-0.5 capitalize">{formatDate(today)}</p>
        </div>
        {existing && (
          <button
            onClick={handleDelete}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-faint hover:bg-coral-soft hover:text-coral transition-colors cursor-pointer"
            title="Borrar entrada de hoy"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="¿Cómo te fue hoy? ¿Qué sentiste? ¿Lograste tus hábitos? Escribe lo que quieras…"
        rows={5}
        maxLength={2000}
        className="w-full resize-none rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-ink outline-none focus:border-signal placeholder:text-ink-faint"
      />

      <div className="flex items-center justify-between">
        <span className="text-xs text-ink-faint">{text.length}/2000</span>
        <div className="flex items-center gap-2">
          {saved && <span className="text-xs text-mint font-medium">¡Guardado!</span>}
          {error && <span className="text-xs text-coral">{error}</span>}
          <button
            onClick={handleSave}
            disabled={saving || !text.trim()}
            className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
          >
            {saving ? "Guardando…" : existing ? "Actualizar" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Entrada pasada con su resumen ──────────────────────────────────────────────
function EntryCard({ entry, summary, onDelete }) {
  const [open, setOpen] = useState(false);
  const today = todayLocalISODate();
  if (entry.entry_date === today) return null;

  return (
    <div className="rounded-xl border border-line bg-panel overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left cursor-pointer hover:bg-panel-alt transition-colors"
      >
        <div>
          <p className="text-sm font-medium text-ink capitalize">{formatDate(entry.entry_date)}</p>
          {summary && (
            <p className="text-xs text-ink-faint mt-0.5 line-clamp-1">{summary.summary}</p>
          )}
          {!summary && (
            <p className="text-xs text-ink-faint mt-0.5 flex items-center gap-1">
              <Sparkles size={10} />
              Resumen pendiente…
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0 ml-3">
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(entry.entry_date); }}
            className="flex h-6 w-6 items-center justify-center rounded text-ink-faint hover:bg-coral-soft hover:text-coral transition-colors cursor-pointer"
          >
            <Trash2 size={13} />
          </button>
          {open ? <ChevronUp size={15} className="text-ink-faint" /> : <ChevronDown size={15} className="text-ink-faint" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-line px-4 py-3 flex flex-col gap-3">
          <p className="text-sm text-ink-soft leading-relaxed whitespace-pre-wrap">{entry.content}</p>
          {summary && (
            <div className="rounded-lg bg-violet-soft px-3 py-2.5">
              <p className="text-[11px] font-semibold text-violet mb-1 flex items-center gap-1">
                <Sparkles size={11} />
                Resumen IA
              </p>
              <p className="text-xs text-ink-soft leading-relaxed">{summary.summary}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Página principal ───────────────────────────────────────────────────────────
export default function Journal() {
  const { entries, summaries, loading, error, saveEntry, deleteEntry, getEntry } = useJournal();

  const summaryByDate = Object.fromEntries(summaries.map((s) => [s.date_from, s]));
  const pastEntries = entries.filter((e) => e.entry_date !== todayLocalISODate());

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-lg font-semibold">Diario</h1>
        <p className="text-sm text-ink-soft mt-0.5">
          Escribe tu reflexión del día. La IA la resume automáticamente.
        </p>
      </div>

      <TodayEditor getEntry={getEntry} saveEntry={saveEntry} deleteEntry={deleteEntry} loading={loading} />

      {loading ? (
        <p className="text-sm text-ink-soft">Cargando…</p>
      ) : error ? (
        <p className="rounded-lg bg-coral-soft px-3 py-2 text-sm text-coral">{error}</p>
      ) : pastEntries.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <BookOpen size={32} className="text-ink-faint" />
          <p className="text-sm text-ink-soft">Aún no hay entradas anteriores.</p>
          <p className="text-xs text-ink-faint">Escribe tu primera reflexión arriba.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-ink-soft">Historial</h2>
          {pastEntries.map((entry) => (
            <EntryCard
              key={entry.id}
              entry={entry}
              summary={summaryByDate[entry.entry_date] || null}
              onDelete={deleteEntry}
            />
          ))}
        </div>
      )}
    </div>
  );
}
