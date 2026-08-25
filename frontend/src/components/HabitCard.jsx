import { Pencil, Trash2 } from "lucide-react";
import { categoryMeta } from "../lib/categories";
import { DAY_LABELS, formatTime, parseDays } from "../lib/schedule";

export default function HabitCard({ habit, onEdit, onDelete }) {
  const meta = categoryMeta(habit.category);
  const Icon = meta.icon;
  const days = parseDays(habit.days_of_week);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `var(--${meta.token}-soft)`, color: `var(--${meta.token})` }}
          >
            <Icon size={17} />
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium">{habit.name}</p>
            {habit.description && (
              <p className="truncate text-xs text-ink-soft">{habit.description}</p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            onClick={() => onEdit(habit)}
            aria-label={`Editar ${habit.name}`}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-panel-alt hover:text-ink cursor-pointer"
          >
            <Pencil size={15} />
          </button>
          <button
            onClick={() => onDelete(habit)}
            aria-label={`Eliminar ${habit.name}`}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-coral-soft hover:text-coral cursor-pointer"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs text-ink-soft tabular">
        {habit.start_time
          ? <span>{formatTime(habit.start_time)} – {formatTime(habit.end_time)}</span>
          : habit.duration_minutes
            ? <span className="font-sans text-ink-soft">{habit.duration_minutes} min</span>
            : <span className="font-sans text-ink-faint">Sin hora fija</span>
        }
        <span
          className="rounded-full px-2 py-0.5 font-sans font-medium"
          style={{ backgroundColor: `var(--${meta.token}-soft)`, color: `var(--${meta.token})` }}
        >
          {meta.label}
        </span>
      </div>

      {habit.recurrence_type === "weekly" || !habit.recurrence_type ? (
        <div className="flex gap-1">
          {DAY_LABELS.map((label, i) => (
            <span
              key={i}
              className={[
                "flex h-6 w-6 items-center justify-center rounded-md text-[10px] font-semibold",
                days.includes(i)
                  ? "bg-ink text-bg"
                  : "bg-panel-alt text-ink-faint",
              ].join(" ")}
            >
              {label[0]}
            </span>
          ))}
        </div>
      ) : habit.recurrence_type === "interval" ? (
        <p className="text-xs text-ink-faint">
          Cada {habit.recurrence_interval} {habit.recurrence_interval === 1 ? "día" : "días"}
        </p>
      ) : habit.recurrence_type === "monthly" ? (
        <p className="text-xs text-ink-faint">
          {habit.recurrence_day_of_month === -1
            ? "Último día del mes"
            : `Día ${habit.recurrence_day_of_month} de cada mes`}
        </p>
      ) : null}
    </div>
  );
}
