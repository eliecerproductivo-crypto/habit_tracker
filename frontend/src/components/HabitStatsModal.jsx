import { X, Flame, Trophy, CheckCircle2, Calendar, ChevronRight } from "lucide-react";
import { useHabitStats } from "../hooks/useHabitStats";
import { categoryMeta } from "../lib/categories";
import { habitOccursOnDate, todayLocalISODate, toLocalISODate } from "../lib/schedule";

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

  // Fecha efectiva de inicio del hábito
  const effectiveStart = habit.start_date
    ? String(habit.start_date).slice(0, 10)
    : (() => {
        const createdRaw = habit.created_at || "";
        const hasZone = createdRaw.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(createdRaw);
        const parsed = new Date(hasZone ? createdRaw : createdRaw + "Z");
        return isNaN(parsed.getTime()) ? today : toLocalISODate(parsed);
      })();

  // Punto de inicio del grid: domingo de hace WEEKS semanas
  const gridStart = new Date(today);
  gridStart.setDate(gridStart.getDate() - (WEEKS * 7 - 1));
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());

  // Índice de logs: { "YYYY-MM-DD": status }
  const logMap = {};
  for (const log of logs) {
    logMap[String(log.date).slice(0, 10)] = log.status;
  }

  const weeks = [];
  const cursor = new Date(gridStart);
  for (let w = 0; w < WEEKS; w++) {
    const days = [];
    for (let d = 0; d < 7; d++) {
      const iso = [
        cursor.getFullYear(),
        String(cursor.getMonth() + 1).padStart(2, "0"),
        String(cursor.getDate()).padStart(2, "0"),
      ].join("-");
      const isFuture = iso > today;
      const scheduled = !isFuture && iso >= effectiveStart && habitOccursOnDate(habit, iso);
      days.push({ iso, scheduled, status: logMap[iso] || null, isFuture });
      cursor.setDate(cursor.getDate() + 1);
    }
    weeks.push(days);
  }
  return weeks;
}

const CELL = 11;
const GAP  = 2;
const STEP = CELL + GAP;

function cellColor(day, isDark) {
  if (day.isFuture || !day.scheduled) return isDark ? "#1E2A3E" : "#E3E7F0";
  if (day.status === "done")          return isDark ? "#34D399" : "#0F9D74";
  if (day.status === "skipped")       return isDark ? "#F5A623" : "#C97A0E";
  if (day.status === "failed")        return isDark ? "#FB7185" : "#D6455D";
  return isDark ? "#4A2030" : "#F5C6CE"; // programado sin log
}

function Heatmap({ habit, logs }) {
  const weeks  = buildHeatmapGrid(habit, logs);
  const isDark = document.documentElement.classList.contains("dark");
  const today  = todayLocalISODate();

  const canvasW = weeks.length * STEP - GAP;
  const canvasH = 7 * STEP - GAP;

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-2">
        {/* Etiquetas de días */}
        <div className="flex flex-col justify-between font-mono text-[9px] text-ink-faint select-none shrink-0"
          style={{ height: canvasH, paddingTop: 1 }}>
          {DAY_LABELS.map((l, i) => (
            <span key={i} style={{ height: CELL, lineHeight: `${CELL}px` }}>
              {i % 2 === 1 ? l : ""}
            </span>
          ))}
        </div>
        <svg width={canvasW} height={canvasH} style={{ display: "block", overflow: "visible" }}>
          {weeks.map((week, wi) =>
            week.map((day, di) => {
              const x = wi * STEP;
              const y = di * STEP;
              const isToday = day.iso === today;
              return (
                <g key={day.iso}>
                  <rect x={x} y={y} width={CELL} height={CELL} rx={2} ry={2}
                    fill={cellColor(day, isDark)}
                    opacity={day.isFuture || !day.scheduled ? 0.5 : 1}
                  >
                    <title>{formatDateFull(day.iso)}{day.status ? ` — ${day.status}` : day.scheduled ? " — sin registrar" : ""}</title>
                  </rect>
                  {isToday && (
                    <rect x={x + 0.5} y={y + 0.5} width={CELL - 1} height={CELL - 1}
                      rx={2} ry={2} fill="none"
                      stroke={isDark ? "#F5A623" : "#C97A0E"} strokeWidth={1.5} />
                  )}
                </g>
              );
            })
          )}
        </svg>
      </div>
      {/* Leyenda */}
      <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-ink-faint">
        {[
          { label: "Completado",    color: isDark ? "#34D399" : "#0F9D74" },
          { label: "Saltado",       color: isDark ? "#F5A623" : "#C97A0E" },
          { label: "Sin registrar", color: isDark ? "#4A2030" : "#F5C6CE" },
          { label: "No programado", color: isDark ? "#1E2A3E" : "#E3E7F0" },
        ].map(({ label, color }) => (
          <span key={label} className="flex items-center gap-1">
            <svg width={CELL} height={CELL}>
              <rect width={CELL} height={CELL} rx={2} fill={color} />
            </svg>
            {label}
          </span>
        ))}
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
                <Heatmap habit={{ ...habit, ...data }} logs={data.logs} />
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
