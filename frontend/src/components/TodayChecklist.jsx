import { useState } from "react";
import { Check, X, MinusCircle, MessageSquare, BarChart2, ChevronDown, ChevronUp } from "lucide-react";
import { categoryMeta } from "../lib/categories";
import { formatTime, toMinutes, todayLocalISODate, habitOccursOnDate, weekDatesOf } from "../lib/schedule";
import HabitMoodModal, { getMoodInfo } from "./HabitMoodModal";
import HabitStatsModal from "./HabitStatsModal";

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

export default function TodayChecklist({ habits, logsByHabitId = {}, weekLogsByHabitId = {}, onSetStatus, date }) {
  const resolvedDate = date || todayLocalISODate();
  const isFuture = resolvedDate > todayLocalISODate();

  // Estado para el modal de estado de ánimo
  const [moodModalHabit, setMoodModalHabit] = useState(null);
  const [pendingStatus, setPendingStatus]   = useState("done");
  const [statsHabit, setStatsHabit]         = useState(null);
  const [doneExpanded, setDoneExpanded]     = useState(false);

  // Mon–Sun dates of the resolved week (for weekly_times quota tracking)
  const weekDates = weekDatesOf(resolvedDate);

  // Build the Set of "done" dates this week for a given weekly_times habit.
  function completedDatesInWeekForHabit(habit) {
    if ((habit.recurrence_type || "weekly") !== "weekly_times") return null;
    const byDate = weekLogsByHabitId[habit.id] || {};
    const done = new Set();
    for (const iso of weekDates) {
      if (byDate[iso]?.status === "done") done.add(iso);
    }
    return done;
  }

  const todays = habits
    .filter((h) => {
      if (h.is_active === false) return false;
      const completedSet = completedDatesInWeekForHabit(h);
      return habitOccursOnDate(h, resolvedDate, completedSet);
    })
    .sort((a, b) => {
      const aMin = toMinutes(a.start_time);
      const bMin = toMinutes(b.start_time);
      if (aMin == null && bMin == null) return 0;
      if (aMin == null) return 1;
      if (bMin == null) return -1;
      return aMin - bMin;
    });

  // Separar pendientes de los que ya tienen un estado registrado
  const pending   = todays.filter((h) => !logsByHabitId[h.id]?.status);
  const completed = todays.filter((h) => !!logsByHabitId[h.id]?.status);

  const handleButtonClick = (habit, statusKey, isActive) => {
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

  if (todays.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line px-5 py-10 text-center">
        <p className="text-sm text-ink-soft">
          No tienes hábitos programados para este día.
        </p>
      </div>
    );
  }

  // Renderiza una fila de hábito (reutilizado para pendientes y completados)
  const renderHabitRow = (habit) => {
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
        {/* Contenido del hábito */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `var(--${meta.token}-soft)`, color: `var(--${meta.token})` }}
          >
            <Icon size={15} />
          </span>

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

            {habit.recurrence_type === "weekly_times" && (() => {
              const target = habit.recurrence_times_per_week ?? 1;
              const byDate = weekLogsByHabitId[habit.id] || {};
              const doneCount = weekDates.filter((iso) => byDate[iso]?.status === "done").length;
              return (
                <p className="text-xs text-ink-faint">
                  <span className={doneCount >= target ? "text-mint font-semibold" : ""}>
                    {doneCount}/{target}
                  </span>
                  {" "}esta semana
                </p>
              );
            })()}
          </div>
        </div>

        {/* Acciones */}
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => setStatsHabit(habit)}
            aria-label={`Ver estadísticas de ${habit.name}`}
            title={`Ver estadísticas de ${habit.name}`}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-violet-soft hover:text-violet cursor-pointer"
          >
            <BarChart2 size={15} />
          </button>

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
        </div>
      </li>
    );
  };

  return (
    <>
      <div className="flex flex-col gap-3">

        {/* ── Hábitos pendientes ── */}
        {pending.length > 0 && (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-panel shadow-xs">
            {pending.map(renderHabitRow)}
          </ul>
        )}

        {/* Si todo está completado y no hay pendientes */}
        {pending.length === 0 && completed.length > 0 && (
          <div className="rounded-2xl border border-mint/30 bg-mint-soft px-5 py-4 text-center">
            <p className="text-sm font-semibold text-mint">¡Todo listo por hoy! 🎉</p>
            <p className="text-xs text-mint/70 mt-0.5">Completaste todos tus hábitos del día.</p>
          </div>
        )}

        {/* ── Acordeón de completados ── */}
        {completed.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-line bg-panel shadow-xs">
            <button
              type="button"
              onClick={() => setDoneExpanded((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-sm text-ink-soft hover:bg-panel-alt/40 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2 font-medium">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-mint/20 text-mint">
                  <Check size={11} strokeWidth={3} />
                </span>
                Ya registrados
                <span className="rounded-full bg-panel-alt border border-line px-2 py-0.5 text-xs font-semibold text-ink-faint">
                  {completed.length}
                </span>
              </span>
              {doneExpanded
                ? <ChevronUp size={16} className="text-ink-faint" />
                : <ChevronDown size={16} className="text-ink-faint" />
              }
            </button>

            {doneExpanded && (
              <ul className="divide-y divide-line border-t border-line">
                {completed.map(renderHabitRow)}
              </ul>
            )}
          </div>
        )}
      </div>

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

      {/* Modal de estadísticas por hábito */}
      {statsHabit && (
        <HabitStatsModal
          habit={statsHabit}
          onClose={() => setStatsHabit(null)}
        />
      )}
    </>
  );
}
