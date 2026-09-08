import { useRef, useEffect } from "react";
import { useYearHeatmap } from "../hooks/useMonthHeatmap";
import { todayLocalISODate } from "../lib/schedule";

// ── Constantes ────────────────────────────────────────────────────────────────
const CELL   = 11;   // px — tamaño del cuadrito
const GAP    = 2;    // px — espacio entre cuadritos
const STEP   = CELL + GAP;
const DAYS   = ["", "L", "", "M", "", "V", ""];   // etiquetas días (solo impares para no saturar)

const MONTH_SHORT = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

// ── Color por estado ──────────────────────────────────────────────────────────
function cellColor(status, isDark) {
  switch (status) {
    case "complete": return isDark ? "#34D399" : "#0F9D74";   // mint
    case "failed":   return isDark ? "#FB7185" : "#D6455D";   // coral
    case "empty":    return isDark ? "#1E2A3E" : "#E3E7F0";   // panel-alt
    default:         return isDark ? "#1E2A3E" : "#E3E7F0";
  }
}

function cellTitle(iso, status) {
  const [y, m, d] = iso.split("-").map(Number);
  const label = new Date(y, m - 1, d).toLocaleDateString("es", {
    weekday: "short", day: "numeric", month: "short",
  });
  switch (status) {
    case "complete": return `${label} — ✅ completo`;
    case "failed":   return `${label} — ❌ incompleto`;
    case "empty":    return `${label} — sin hábitos`;
    default:         return label;
  }
}

// ── Componente ────────────────────────────────────────────────────────────────
export default function MonthHeatmap({ habits }) {
  const { days, loading } = useYearHeatmap(habits);
  const scrollRef = useRef(null);
  const today     = todayLocalISODate();
  const isDark    = document.documentElement.classList.contains("dark");

  // Hacer scroll al final (mes actual) al montar
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [days]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-line bg-panel p-4">
        <p className="text-xs text-ink-faint">Cargando actividad…</p>
        <div className="mt-3 flex gap-0.5 overflow-hidden opacity-30">
          {Array.from({ length: 52 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-0.5">
              {Array.from({ length: 7 }).map((__, j) => (
                <div key={j} style={{ width: CELL, height: CELL }} className="rounded-sm bg-panel-alt animate-pulse" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (days.length === 0) return null;

  // ── Construir columnas (semanas) ──────────────────────────────────────────
  // Rellenar al inicio para que la primera columna empiece en domingo (0)
  const firstDow = new Date(days[0].iso + "T00:00:00").getDay(); // 0=dom
  const padded = [
    ...Array.from({ length: firstDow }, (_, i) => ({ iso: `pad-${i}`, status: "pad" })),
    ...days,
  ];

  // Dividir en semanas de 7
  const weeks = [];
  for (let i = 0; i < padded.length; i += 7) {
    weeks.push(padded.slice(i, i + 7));
  }

  // ── Etiquetas de mes ──────────────────────────────────────────────────────
  // Para cada semana, si el primer día real de esa semana es el 1 del mes → label
  const monthLabels = weeks.map((week) => {
    const firstReal = week.find((d) => !d.iso.startsWith("pad"));
    if (!firstReal) return "";
    const day = Number(firstReal.iso.slice(8));
    if (day <= 7) return MONTH_SHORT[Number(firstReal.iso.slice(5, 7)) - 1];
    return "";
  });

  // Stats rápidas
  const complete = days.filter((d) => d.status === "complete").length;
  const failed   = days.filter((d) => d.status === "failed").length;
  const scheduled = complete + failed;
  const pct = scheduled > 0 ? Math.round((complete / scheduled) * 100) : null;

  const canvasW = weeks.length * STEP - GAP;
  const canvasH = 7 * STEP - GAP;
  const LABEL_W = 18;   // px reservados para etiquetas de días

  return (
    <div className="rounded-2xl border border-line bg-panel p-4 md:p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-ink">Actividad del año</p>
        {pct !== null && (
          <p className="text-xs text-ink-faint">
            {complete} días completos
            <span className={[
              "ml-1.5 font-semibold",
              pct >= 80 ? "text-mint" : pct >= 50 ? "text-signal" : "text-coral",
            ].join(" ")}>
              · {pct}%
            </span>
          </p>
        )}
      </div>

      {/* Grid con scroll horizontal */}
      <div className="flex gap-1">
        {/* Etiquetas fijas de días (L M X J V S D) */}
        <div
          className="shrink-0 flex flex-col justify-between font-mono text-[9px] text-ink-faint select-none"
          style={{ width: LABEL_W, height: canvasH, paddingTop: 1 }}
        >
          {DAYS.map((l, i) => (
            <span key={i} style={{ height: CELL, lineHeight: `${CELL}px` }}>{l}</span>
          ))}
        </div>

        {/* Zona scrollable */}
        <div ref={scrollRef} className="overflow-x-auto pb-1" style={{ scrollbarWidth: "thin" }}>
          {/* Etiquetas de meses */}
          <div className="flex mb-1" style={{ width: canvasW }}>
            {weeks.map((_, wi) => (
              <div
                key={wi}
                className="shrink-0 font-mono text-[9px] text-ink-faint"
                style={{ width: STEP }}
              >
                {monthLabels[wi]}
              </div>
            ))}
          </div>

          {/* Cuadritos */}
          <svg
            width={canvasW}
            height={canvasH}
            style={{ display: "block", overflow: "visible" }}
          >
            {weeks.map((week, wi) =>
              week.map((day, di) => {
                if (day.iso.startsWith("pad")) return null;
                const x = wi * STEP;
                const y = di * STEP;
                const isToday = day.iso === today;
                const color = cellColor(day.status, isDark);
                return (
                  <g key={day.iso}>
                    <rect
                      x={x}
                      y={y}
                      width={CELL}
                      height={CELL}
                      rx={2}
                      ry={2}
                      fill={color}
                      opacity={day.status === "empty" ? 0.6 : 1}
                    >
                      <title>{cellTitle(day.iso, day.status)}</title>
                    </rect>
                    {isToday && (
                      <rect
                        x={x + 0.5}
                        y={y + 0.5}
                        width={CELL - 1}
                        height={CELL - 1}
                        rx={2}
                        ry={2}
                        fill="none"
                        stroke={isDark ? "#F5A623" : "#C97A0E"}
                        strokeWidth={1.5}
                      />
                    )}
                  </g>
                );
              })
            )}
          </svg>
        </div>
      </div>

      {/* Leyenda */}
      <div className="mt-3 flex gap-3 text-[10px] text-ink-faint justify-end">
        <span className="flex items-center gap-1">
          <svg width={CELL} height={CELL}><rect width={CELL} height={CELL} rx={2} fill={cellColor("empty",   isDark)} opacity={0.6} /></svg>
          Sin hábitos
        </span>
        <span className="flex items-center gap-1">
          <svg width={CELL} height={CELL}><rect width={CELL} height={CELL} rx={2} fill={cellColor("failed",  isDark)} /></svg>
          Incompleto
        </span>
        <span className="flex items-center gap-1">
          <svg width={CELL} height={CELL}><rect width={CELL} height={CELL} rx={2} fill={cellColor("complete",isDark)} /></svg>
          Completo
        </span>
      </div>
    </div>
  );
}
