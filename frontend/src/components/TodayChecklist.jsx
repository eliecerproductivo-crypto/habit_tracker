import { Check, X, MinusCircle } from "lucide-react";
import { categoryMeta } from "../lib/categories";
import { formatTime, toMinutes, todayLocalISODate, habitOccursOnDate } from "../lib/schedule";

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

  const todays = habits
    .filter((h) => h.is_active !== false && habitOccursOnDate(h, resolvedDate))
    .sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time));

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
    <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-panel">
      {todays.map((habit) => {
        const meta = categoryMeta(habit.category);
        const Icon = meta.icon;
        const currentStatus = logsByHabitId[habit.id]?.status ?? null;

        return (
          <li
            key={habit.id}
            className="flex items-center gap-3 px-4 py-3.5"
          >
            {/* Category icon */}
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: `var(--${meta.token}-soft)`, color: `var(--${meta.token})` }}
            >
              <Icon size={15} />
            </span>

            {/* Name + time */}
            <div className="min-w-0 flex-1">
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
              <p className="font-mono text-xs text-ink-faint tabular">
                {formatTime(habit.start_time)} – {formatTime(habit.end_time)}
              </p>
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
                      onClick={() => onSetStatus(habit.id, isActive ? null : statusKey)}
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
  );
}
