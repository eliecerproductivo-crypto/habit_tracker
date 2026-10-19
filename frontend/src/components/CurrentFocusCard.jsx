import { useState } from "react";
import { Check, X, MinusCircle, ArrowRight, BedDouble } from "lucide-react";
import DayRail from "./DayRail";
import HabitMoodModal from "./HabitMoodModal";
import { categoryMeta } from "../lib/categories";
import { formatTime, getCurrentAndNext, formatDateLabel, todayLocalISODate, getHabitRestEligibility, getHabitTimesForDate } from "../lib/schedule";
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
  {
    key: "rest",
    label: "Descansar",
    icon: BedDouble,
    activeClass: "bg-violet text-white border-violet",
    idleClass: "border-line text-ink-faint hover:border-violet hover:text-violet",
  },
];

export default function CurrentFocusCard({
  habits,
  logsByHabitId = {},
  weekLogsByHabitId = {},
  onSetStatus,
  date,
  habitWildcard = null,
  onRest = null,
  onUndoRest = null,
}) {
  const now = useNow();
  const isToday = !date || date === todayLocalISODate();

  // Estado para el modal de ánimo/energía
  const [moodModalHabit, setMoodModalHabit] = useState(null);
  const [pendingStatus, setPendingStatus]   = useState("done");
  const [restLoading, setRestLoading]       = useState(false);

  const handleStatusClick = async (habit, statusKey, isActive) => {
    if (statusKey === "rest") {
      setRestLoading(true);
      try {
        if (isActive) {
          if (onUndoRest) await onUndoRest(habit.id);
        } else {
          if (onRest) await onRest(habit.id);
        }
      } catch {
        // silent
      } finally {
        setRestLoading(false);
      }
      return;
    }
    if (isActive) {
      onSetStatus(habit.id, null);
    } else {
      onSetStatus(habit.id, statusKey);
      setPendingStatus(statusKey);
      setMoodModalHabit(habit);
    }
  };

  const handleSaveMood = (data) => {
    if (moodModalHabit) {
      onSetStatus(moodModalHabit.id, pendingStatus, data);
    }
    setMoodModalHabit(null);
  };
  const { current, next } = isToday ? getCurrentAndNext(habits, now) : { current: null, next: null };

  const clock = now.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
  const dateLabel = isToday
    ? now.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" })
    : formatDateLabel(date);

  const meta = current ? categoryMeta(current.category) : null;
  const currentStatus = current ? (logsByHabitId[current.id]?.status ?? null) : null;

  return (
    <section
      className="rounded-2xl border border-line p-3.5 shadow-[var(--shadow-card)] md:p-4"
      style={{
        background: current
          ? `linear-gradient(135deg, var(--${meta.token}-soft), var(--panel))`
          : "var(--panel)",
      }}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
        <p className="text-xs capitalize text-ink-soft">{dateLabel}</p>
        {isToday && <p className="font-mono text-xs tabular text-ink-faint">{clock}</p>}
      </div>

      <div className="mt-2.5">
        {current ? (
          <div className="flex flex-col gap-2.5">
            <div className="min-w-0">
              <p
                className="mb-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide"
                style={{ color: `var(--${meta.token})` }}
              >
                Ahora mismo · {meta.label}
              </p>
              <h2 className={[
                "truncate text-lg font-semibold tracking-tight md:text-xl",
                currentStatus === "done"
                  ? "text-ink-faint line-through"
                  : currentStatus === "failed"
                  ? "text-coral/70 line-through"
                  : "text-ink",
              ].join(" ")}>
                {current.name}
              </h2>
              {(() => {
                const times = getHabitTimesForDate(current, now);
                return times.start_time ? (
                  <p className="font-mono text-xs text-ink-soft tabular">
                    {formatTime(times.start_time)} – {formatTime(times.end_time)}
                  </p>
                ) : null;
              })()}
            </div>

            {/* action buttons */}
            <div className="flex flex-wrap gap-1.5">
              {STATUS_CONFIG.map(({ key, label, icon: BtnIcon, activeClass, idleClass }) => {
                const isActive = currentStatus === key;

                // "Descansar" — manejo especial
                if (key === "rest") {
                  if (!isToday) return null;
                  const { canRest, reason: restReason } = getHabitRestEligibility(
                    current,
                    habitWildcard,
                    logsByHabitId,
                    weekLogsByHabitId,
                    todayLocalISODate()
                  );
                  const tooltipText = isActive
                    ? "Deshacer descanso de hoy"
                    : canRest
                      ? `Descansar hoy (${habitWildcard?.quota_remaining ?? 0} restantes)`
                      : (restReason || "No disponible");

                  return (
                    <button
                      key={key}
                      disabled={(!canRest && !isActive) || restLoading}
                      onClick={() => isToday && handleStatusClick(current, key, isActive)}
                      title={tooltipText}
                      className={[
                        "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                        restLoading
                          ? "cursor-wait border-line text-ink-faint opacity-50"
                          : isActive
                            ? `cursor-pointer ${activeClass}`
                            : canRest
                              ? `cursor-pointer ${idleClass}`
                              : "cursor-not-allowed border-line text-ink-faint opacity-30",
                      ].join(" ")}
                    >
                      <BtnIcon size={13} strokeWidth={2.5} />
                      {label}
                    </button>
                  );
                }

                return (
                  <button
                    key={key}
                    disabled={!isToday}
                    onClick={() => isToday && handleStatusClick(current, key, isActive)}
                    className={[
                      "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors",
                      isToday
                        ? isActive
                          ? `cursor-pointer ${activeClass}`
                          : `cursor-pointer ${idleClass}`
                        : "cursor-not-allowed border-line text-ink-faint opacity-40",
                    ].join(" ")}
                  >
                    <BtnIcon size={13} strokeWidth={2.5} />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
              {isToday ? "Sin bloque activo" : "Vista del día"}
            </p>
            <h2 className="mt-0.5 text-base font-semibold text-ink-soft md:text-lg">
              {isToday
                ? "No tienes un hábito programado ahora"
                : "Revisa y marca los hábitos de este día abajo"}
            </h2>
          </div>
        )}

        {next && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-ink-faint">
            <ArrowRight size={13} />
            <span>
              Siguiente:{" "}
              <span className="font-medium text-ink-soft">{next.name}</span>{" "}
              a las {formatTime(getHabitTimesForDate(next, now).start_time)}
            </span>
          </div>
        )}
      </div>

      <div className="mt-3">
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

      {/* Modal de ánimo/energía tras completar desde el bloque actual */}
      {moodModalHabit && (
        <HabitMoodModal
          isOpen={Boolean(moodModalHabit)}
          habit={moodModalHabit}
          status={pendingStatus}
          initialMood={logsByHabitId[moodModalHabit.id]?.mood || null}
          initialNote={logsByHabitId[moodModalHabit.id]?.note || ""}
          onSave={handleSaveMood}
          onClose={() => setMoodModalHabit(null)}
        />
      )}
    </section>
  );
}
