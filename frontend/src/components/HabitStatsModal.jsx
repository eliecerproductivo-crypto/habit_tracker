import { X, Flame, Trophy, CheckCircle2, Calendar, ChevronRight } from "lucide-react";
import { useHabitStats } from "../hooks/useHabitStats";
import { categoryMeta } from "../lib/categories";
import { habitOccursOnDate, todayLocalISODate, addDays } from "../lib/schedule";

// ── Helpers ───────────────────────────────────────────────────────────────────

const MOOD_META = {
  great:   { label: "Excelente", color: "bg-mint",     dot: "bg-mint" },
  good:    { label: "Bien",      color: "bg-sky",      dot: "bg-sky" },
  neutral: { label: "Normal",    color: "bg-ink-faint", dot: "bg-ink-faint" },
  tired:   { label: "Cansado",   color: "bg-signal",   dot: "bg-signal" },
  hard:    { label: "Difícil",   color: "bg-coral",    dot: "bg-coral" },
};

function formatDateShort(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es", {
    day: "numeric", month: "short",
  });
}

function formatDateFull(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es", {
    weekday: "long", day: "numeric", month: "long",
  });
}

// ── Heatmap ───────────────────────────────────────────────────────────────────
// Muestra las últimas WEEKS semanas (cols) × 7 días (filas).
// Las columnas van de la más antigua (izq) a la más reciente (der).
const WEEKS = 14;          // 14 semanas = 98 días de historial
const DAY_LABELS = ["D", "L", "M", "M", "J", "V", "S"];

function buildHeatmapGrid(habit, logs) {
  const today = todayLocalISODate();

  // Fecha efectiva de inicio del hábito (igual que el backend)
  const effectiveStart = habit.start_date
    ? String(habit.start_date).slice(0, 10)
    : (habit.created_at
        ? (() => {
            const raw = habit.created_at;
            const hasZone = raw.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(raw);
            const parsed = new Date(hasZone ? raw : raw + "Z");
            return isNaN(parsed.getTime()) ? today : parsed.toISOString().slice(0, 10);
          })()
        : today);

  const todayDate = new Date(today);
  const startOffset = (WEEKS * 7) - 1;
  const raw = new Date(todayDate);
  raw.setDate(raw.getDate() - startOffset);
  // Retroceder hasta el domingo más cercano para alinear columnas
  const dow = raw.getDay();
  raw.setDate(raw.getDate() - dow);

  const logMap = {};
  for (const log of logs) {
    logMap[log.date] = log.status;
  }

  const weeks = [];
  let cursor = new Date(raw);
  for (let w = 0; w < WEEKS; w++) {
    const days = [];
    for (let d = 0; d < 7; d++) {
      // Usar fecha local para evitar desfase de zona horaria
      const iso = [
        cursor.getFullYear(),
        String(cursor.getMonth() + 1).padStart(2, "0"),
        String(cursor.getDate()).padStart(2, "0"),
      ].join("-");
      const isFuture = iso > today;
      const scheduled = !isFuture && iso >= effectiveStart && habitOccursOnDate(habit, iso);
      const status = logMap[iso] || null;
      days.push({ iso, scheduled, status, isFuture });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(days);
  }
  return weeks;
}

function cellClass(day) {
  if (day.isFuture) return "bg-panel-alt opacity-30";
  if (!day.scheduled) return "bg-panel-alt opacity-20";
  if (day.status === "done")    return "bg-mint";
  if (day.status === "skipped") return "bg-signal opacity-70";
  if (day.status === "failed")  return "bg-coral opacity-80";
  // programado pero sin log (fallo implícito si ya pasó)
  return "bg-coral/30";
}

function Heatmap({ habit, logs }) {
  const weeks = buildHeatmapGrid(habit, logs);
  return (
    <div className="overflow-x-auto">
      <div className="flex gap-1 min-w-max">
        {/* Etiquetas de días */}
        <div className="flex flex-col gap-1 mr-1">
          {DAY_LABELS.map((l, i) => (
            <span key={i} className="flex h-3.5 w-4 items-center text-[9px] font-mono text-ink-faint">
              {i % 2 === 1 ? l : ""}
            </span>
          ))}
        </div>
        {/* Columnas por semana */}
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-1">
            {week.map((day) => (
              <div
                key={day.iso}
                title={`${formatDateFull(day.iso)}${day.status ? ` — ${day.status}` : day.scheduled ? " — sin registrar" : ""}`}
                className={`h-3.5 w-3.5 rounded-sm transition-opacity cursor-default ${cellClass(day)}`}
              />
            ))}
          </div>
        ))}
      </div>
      {/* Leyenda */}
      <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-ink-faint">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-mint inline-block" /> Completado</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-signal opacity-70 inline-block" /> Saltado</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-coral/30 inline-block" /> Sin registrar</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-panel-alt opacity-20 inline-block" /> No programado</span>
      </div>
    </div>
  );
}

// ── Stat mini-card ────────────────────────────────────────────────────────────
function MiniStat({ icon: Icon, label, value, accent = "mint" }) {
  return (
    <div className="flex flex-1 flex-col gap-1 rounded-xl border border-line bg-panel-alt p-3">
      <div className="flex items-center gap-1.5 text-xs text-ink-faint">
        <Icon size={13} />
        {label}
      </div>
      <p className={`font-mono text-xl font-bold text-${accent}`}>{value}</p>
    </div>
  );
}

// ── Log row ───────────────────────────────────────────────────────────────────
const STATUS_META = {
  done:    { label: "Completado", cls: "bg-mint-soft text-mint" },
  skipped: { label: "Saltado",    cls: "bg-signal-soft text-signal" },
  failed:  { label: "Fallido",    cls: "bg-coral-soft text-coral" },
};

function LogRow({ log }) {
  const sm = STATUS_META[log.status] || STATUS_META.done;
  const mood = log.mood ? MOOD_META[log.mood] : null;
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-line last:border-0">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-xs font-semibold text-ink">
            {formatDateShort(log.date)}
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${sm.cls}`}>
            {sm.label}
          </span>
          {mood && (
            <span className="flex items-center gap-1 text-[10px] text-ink-soft">
              <span className={`h-2 w-2 rounded-full ${mood.dot}`} />
              {mood.label}
            </span>
          )}
        </div>
        {log.note && (
          <p className="mt-0.5 text-xs text-ink-soft italic line-clamp-2">{log.note}</p>
        )}
      </div>
    </div>
  );
}

// ── Modal principal ───────────────────────────────────────────────────────────
export default function HabitStatsModal({ habit, onClose }) {
  const { data, loading, error } = useHabitStats(habit?.id);
  const meta = categoryMeta(habit?.category);
  const Icon = meta.icon;

  if (!habit) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 md:items-center md:p-4">
      <div className="flex w-full max-w-2xl flex-col rounded-t-2xl border border-line bg-panel shadow-2xl md:rounded-2xl max-h-[90dvh]">

        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 border-b border-line px-5 py-4">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `var(--${meta.token}-soft)`, color: `var(--${meta.token})` }}
          >
            <Icon size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-ink">{habit.name}</p>
            <p className="text-xs text-ink-soft">{meta.label}</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-faint hover:bg-panel-alt hover:text-ink transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">

          {loading && (
            <p className="text-sm text-ink-soft text-center py-8">Cargando estadísticas…</p>
          )}
          {error && (
            <p className="rounded-xl bg-coral-soft px-4 py-3 text-sm text-coral">{error}</p>
          )}

          {data && (
            <>
              {/* Mini stats */}
              <div className="flex flex-wrap gap-2">
                <MiniStat icon={Flame}        label="Racha actual"   value={`${data.current_streak}d`} accent="mint" />
                <MiniStat icon={Trophy}       label="Mejor racha"    value={`${data.best_streak}d`}    accent="signal" />
                <MiniStat icon={CheckCircle2} label="Completados"    value={data.total_done}            accent="violet" />
                <MiniStat icon={Calendar}     label="Cumplimiento"   value={`${data.completion_rate}%`} accent="sky" />
              </div>

              {/* Heatmap */}
              <div>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-faint">
                  Actividad — últimas {WEEKS} semanas
                </h3>
                <Heatmap habit={habit} logs={data.logs} />
              </div>

              {/* Historial de logs */}
              <div>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-faint">
                  Historial de registros ({data.total_done} completados de {data.total_scheduled} programados)
                </h3>
                {data.logs.length === 0 ? (
                  <p className="py-6 text-center text-sm text-ink-faint">
                    Aún no hay registros para este hábito.
                  </p>
                ) : (
                  <div>
                    {data.logs.map((log) => (
                      <LogRow key={log.id} log={log} />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
