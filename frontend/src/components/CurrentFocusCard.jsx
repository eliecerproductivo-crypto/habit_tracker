import { CheckCircle2, Circle, ArrowRight } from "lucide-react";
import DayRail from "./DayRail";
import { categoryMeta } from "../lib/categories";
import { formatTime, getCurrentAndNext, formatDateLabel, todayLocalISODate } from "../lib/schedule";
import { useNow } from "../hooks/useNow";

export default function CurrentFocusCard({ habits, completedHabitIds, onToggle, date }) {
  const now = useNow();
  const isToday = !date || date === todayLocalISODate();
  const { current, next } = isToday ? getCurrentAndNext(habits, now) : { current: null, next: null };

  const clock = now.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
  const dateLabel = isToday
    ? now.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" })
    : formatDateLabel(date);

  const currentDone = current ? completedHabitIds.has(current.id) : false;
  const meta = current ? categoryMeta(current.category) : null;

  return (
    <section
      className="rounded-2xl border border-line p-5 shadow-[var(--shadow-card)] md:p-6"
      style={{
        background: current
          ? `linear-gradient(135deg, var(--${meta.token}-soft), var(--panel))`
          : "var(--panel)",
      }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-sm capitalize text-ink-soft">{dateLabel}</p>
        {isToday && <p className="font-mono text-sm tabular text-ink-faint">{clock}</p>}
      </div>

      <div className="mt-4">
        {current ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p
                className="mb-1 font-mono text-[11px] font-semibold uppercase tracking-wide"
                style={{ color: `var(--${meta.token})` }}
              >
                Ahora mismo · {meta.label}
              </p>
              <h2 className="truncate text-2xl font-semibold tracking-tight md:text-3xl">
                {current.name}
              </h2>
              <p className="mt-1 font-mono text-sm text-ink-soft tabular">
                {formatTime(current.start_time)} – {formatTime(current.end_time)}
              </p>
            </div>

            <button
              onClick={() => onToggle(current.id, !currentDone)}
              className={[
                "flex shrink-0 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-colors cursor-pointer",
                currentDone ? "bg-mint-soft text-mint" : "bg-ink text-bg hover:opacity-90",
              ].join(" ")}
            >
              {currentDone ? <CheckCircle2 size={18} aria-hidden="true" /> : <Circle size={18} aria-hidden="true" />}
              {currentDone ? "Completado" : "Marcar como hecho"}
            </button>
          </div>
        ) : (
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
              {isToday ? "Sin bloque activo" : "Vista del día"}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-ink-soft md:text-2xl">
              {isToday
                ? "No tienes un hábito programado en este momento"
                : "Revisa y marca los hábitos de este día abajo"}
            </h2>
          </div>
        )}

        {next && (
          <div className="mt-3 flex items-center gap-1.5 text-sm text-ink-faint">
            <ArrowRight size={14} />
            <span>
              Siguiente:{" "}
              <span className="font-medium text-ink-soft">{next.name}</span>{" "}
              a las {formatTime(next.start_time)}
            </span>
          </div>
        )}
      </div>

      <div className="mt-6">
        <DayRail
          habits={habits}
          now={now}
          date={date}
          showNow={isToday}
          completedHabitIds={completedHabitIds}
        />
      </div>
    </section>
  );
}
