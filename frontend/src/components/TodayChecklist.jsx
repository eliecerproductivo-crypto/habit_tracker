import { useState } from "react";
import { Check, X, MinusCircle, MessageSquare } from "lucide-react";
import { categoryMeta } from "../lib/categories";
import { formatTime, toMinutes, todayLocalISODate, habitOccursOnDate } from "../lib/schedule";
import HabitMoodModal, { getMoodInfo } from "./HabitMoodModal";

const STATUS_CONFIG = {
  done: {
    icon: Check,
    label: "Hecho",
    activeClass: "bg-mint text-white border-mint",
    hoverClass: "hover:border-mint hover:text-mint",
  },
  skipped: {
    icon: MinusCircle,
    label: "Omitir",
    activeClass: "bg-signal text-white border-signal",
    hoverClass: "hover:border-signal hover:text-signal",
  },
  failed: {
    icon: X,
    label: "Fallido",
    activeClass: "bg-coral text-white border-coral",
    hoverClass: "hover:border-coral hover:text-coral",
  },
};

export default function TodayChecklist({ habits, logsByHabitId = {}, onSetStatus, date }) {
  const resolvedDate = date || todayLocalISODate();
  const isFuture = resolvedDate > todayLocalISODate();

  // Estado para el modal de estado de ánimo
  const [moodModalHabit, setMoodModalHabit] = useState(null);
  const [pendingStatus, setPendingStatus] = useState("done");

  const todays = habits
    .filter((h) => h.is_active !== false && habitOccursOnDate(h, resolvedDate))
    .sort((a, b) => {
      const aMin = toMinutes(a.start_time);
      const bMin = toMinutes(b.start_time);
      if (aMin == null && bMin == null) return 0;
      if (aMin == null) return 1;
      if (bMin == null) return -1;
      return aMin - bMin;
    });

  const handleButtonClick = (habit, statusKey, isActive) => {
    if (isActive) {
      // Si ya estaba activo y se toca de nuevo, se desmarca (vuelve a null)
      onSetStatus(habit.id, null);
    } else {
      // Marcamos el estado en el log inmediatamente
      onSetStatus(habit.id, statusKey);
      // Y abrimos el modal rápido de ánimo y nota
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

  if (todays.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line px-5 py-10 text-center">
        <p className="text-sm text-ink-soft">
          No tienes hábitos programados para este día.
        </p>
      </div>
    );
  }

  return (
    <>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-panel shadow-xs">
        {todays.map((habit) => {
          const meta = categoryMeta(habit.category);
          const Icon = meta.icon;
          const log = logsByHabitId[habit.id];
          const currentStatus = log?.status ?? null;
          const currentMood = log?.mood ? getMoodInfo(log.mood) : null;
          const hasNote = Boolean(log?.note && log.note.trim());

          return (
            <li
              key={habit.id}
              className="flex items-center gap-3 px-4 py-3.5 hover:bg-panel-alt/30 transition-colors"
            >
              {/* Category icon */}
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: `var(--${meta.token}-soft)`, color: `var(--${meta.token})` }}
              >
                <Icon size={15} />
              </span>

              {/* Name + time + micro-nota */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className={[
                    "truncate text-sm font-medium",
                    currentStatus === "done"
                      ? "text-ink-faint line-through"
                      : currentStatus === "failed"
                      ? "text-coral/70 line-through"
                      : "text-ink",
                  ].join(" ")}>
                    {habit.name}
                  </p>

                  {/* Chip de Ánimo si ya fue registrado */}
                  {(currentMood || hasNote) && (
                    <button
                      type="button"
                      onClick={() => {
                        setPendingStatus(currentStatus || "done");
                        setMoodModalHabit(habit);
                      }}
                      title={log?.note || currentMood?.label}
                      className="inline-flex items-center gap-1 rounded-full bg-panel-alt border border-line px-2 py-0.5 text-[11px] text-ink hover:border-signal transition-colors cursor-pointer"
                    >
                      {currentMood && <span>{currentMood.emoji}</span>}
                      {hasNote && <MessageSquare size={11} className="text-signal" />}
                      <span className="text-[10px] font-medium text-ink-soft truncate max-w-[120px]">
                        {log?.note || currentMood?.label}
                      </span>
                    </button>
                  )}
                </div>

                {habit.start_time ? (
                  <p className="font-mono text-xs text-ink-faint tabular">
                    {formatTime(habit.start_time)} – {formatTime(habit.end_time)}
                  </p>
                ) : habit.duration_minutes ? (
                  <p className="text-xs text-ink-faint">{habit.duration_minutes} min</p>
                ) : null}
              </div>

              {/* Status buttons — ocultos en fechas futuras */}
              {!isFuture && (
                <div className="flex shrink-0 gap-1">
                  {Object.entries(STATUS_CONFIG).map(([statusKey, cfg]) => {
                    const BtnIcon = cfg.icon;
                    const isActive = currentStatus === statusKey;

                    return (
                      <button
                        key={statusKey}
                        onClick={() => handleButtonClick(habit, statusKey, isActive)}
                        aria-label={cfg.label}
                        title={cfg.label}
                        className={[
                          "flex h-7 w-7 items-center justify-center rounded-full border-2 transition-colors cursor-pointer",
                          isActive
                            ? `${cfg.activeClass}`
                            : `border-line text-transparent ${cfg.hoverClass}`,
                        ].join(" ")}
                      >
                        <BtnIcon size={13} strokeWidth={2.5} />
                      </button>
                    );
                  })}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {/* Modal de Ánimo y Nota */}
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
    </>
  );
}
