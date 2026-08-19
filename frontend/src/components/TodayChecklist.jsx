import { Check } from "lucide-react";
import { categoryMeta } from "../lib/categories";
import { formatTime, parseDays, toMinutes } from "../lib/schedule";

export default function TodayChecklist({ habits, completedHabitIds, onToggle }) {
  const today = new Date().getDay();
  const todays = habits
    .filter((h) => h.is_active !== false && parseDays(h.days_of_week).includes(today))
    .sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time));

  if (todays.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-line px-5 py-10 text-center">
        <p className="text-sm text-ink-soft">
          No tienes hábitos programados para hoy.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-panel">
      {todays.map((habit) => {
        const meta = categoryMeta(habit.category);
        const done = completedHabitIds.has(habit.id);
        const Icon = meta.icon;
        return (
          <li
            key={habit.id}
            className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-panel-alt/60"
          >
            <button
              onClick={() => onToggle(habit.id, !done)}
              aria-pressed={done}
              aria-label={done ? `Marcar ${habit.name} como pendiente` : `Marcar ${habit.name} como hecho`}
              className={[
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors cursor-pointer",
                done
                  ? "border-mint bg-mint text-white"
                  : "border-line text-transparent hover:border-ink-faint",
              ].join(" ")}
            >
              <Check size={14} strokeWidth={3} />
            </button>

            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: `var(--${meta.token}-soft)`, color: `var(--${meta.token})` }}
            >
              <Icon size={15} />
            </span>

            <div className="min-w-0 flex-1">
              <p className={["truncate text-sm font-medium", done ? "text-ink-faint line-through" : "text-ink"].join(" ")}>
                {habit.name}
              </p>
              <p className="font-mono text-xs text-ink-faint tabular">
                {formatTime(habit.start_time)} – {formatTime(habit.end_time)}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
