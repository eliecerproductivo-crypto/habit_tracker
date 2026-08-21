import { Check, X, MinusCircle, ArrowRight } from "lucide-react";
import DayRail from "./DayRail";
import { categoryMeta } from "../lib/categories";
import { formatTime, getCurrentAndNext, formatDateLabel, todayLocalISODate } from "../lib/schedule";
import { useNow } from "../hooks/useNow";

const STATUS_CONFIG = [
  {
    key: "done",
    label: "Hecho",
    icon: Check,
    activeClass: "bg-mint text-white border-mint",
    idleClass: "border-line text-ink-faint hover:border-mint hover:text-mint",
  },
  {
    key: "skipped",
    label: "Omitir",
    icon: MinusCircle,
    activeClass: "bg-signal text-white border-signal",
    idleClass: "border-line text-ink-faint hover:border-signal hover:text-signal",
  },
  {
    key: "failed",
    label: "Fallido",
    icon: X,
    activeClass: "bg-coral text-white border-coral",
    idleClass: "border-line text-ink-faint hover:border-coral hover:text-coral",
  },
];

export default function CurrentFocusCard({ habits, logsByHabitId = {}, onSetStatus, date }) {
  const now = useNow();
  const isToday = !date || date === todayLocalISODate();
  const { current, next } = isToday ? getCurrentAndNext(habits, now) : { current: null, next: null };

  const clock = now.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
  const dateLabel = isToday
    ? now.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" })
    : formatDateLabel(date);

  const meta = current ? categoryMeta(current.category) : null;
  const currentStatus = current ? (logsByHabitId[current.id]?.status ?? null) : null;

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
          <div className="flex flex-col gap-4">
            {/* Habit info */}
            <div className="min-w-0">
              <p
                className="mb-1 font-mono text-[11px] font-semibold uppercase tracking-wide"
                style={{ color: `var(--${meta.token})` }}
              >
                Ahora mismo · {meta.label}
              </p>
              <h2 className={[
                "truncate text-2xl font-semibold tracking-tight md:text-3xl",
                currentStatus === "done"
                  ? "text-ink-faint line-through"
                  : currentStatus === "failed"
                  ? "text-coral/70 line-through"
                  : "text-ink",
              ].join(" ")}>
                {current.name}
              </h2>
              <p className="mt-1 font-mono text-sm text-ink-soft tabular">
                {formatTime(current.start_time)} – {formatTime(current.end_time)}
              </p>
            </div>

            {/* 3-state action buttons */}
            <div className="flex flex-wrap gap-2">
              {STATUS_CONFIG.map(({ key, label, icon: BtnIcon, activeClass, idleClass }) => {
                const isActive = currentStatus === key;
                return (
                  <button
                    key={key}
                    disabled={!isToday}
                    onClick={() => isToday && onSetStatus(current.id, isActive ? null : key)}
                    className={[
                      "flex items-center gap-2 rounded-xl border-2 px-4 py-2 text-sm font-semibold transition-colors",
                      isToday
                        ? isActive
                          ? `cursor-pointer ${activeClass}`
                          : `cursor-pointer ${idleClass}`
                        : "cursor-not-allowed border-line text-ink-faint opacity-40",
                    ].join(" ")}
                  >
                    <BtnIcon size={15} strokeWidth={2.5} />
                    {label}
                  </button>
                );
              })}
            </div>
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
          completedHabitIds={new Set(
            Object.entries(logsByHabitId)
              .filter(([, log]) => log.status === "done")
              .map(([id]) => Number(id))
          )}
        />
      </div>
    </section>
  );
}
