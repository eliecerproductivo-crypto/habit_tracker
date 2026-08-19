import { categoryMeta } from "../lib/categories";
import { parseDays, toMinutes, formatTime } from "../lib/schedule";

const DAY_MIN = 24 * 60;
const VIEW_START = 5 * 60 + 30;  // 5:30 AM in minutes
const VIEW_END   = 22 * 60;       // 10:00 PM in minutes
const VIEW_RANGE = VIEW_END - VIEW_START;

// Ticks incluyen los extremos del rango visible
const TICKS = [
  { minutes: VIEW_START, align: "left" },
  { minutes: 9 * 60,     align: "center" },
  { minutes: 12 * 60,    align: "center" },
  { minutes: 15 * 60,    align: "center" },
  { minutes: 18 * 60,    align: "center" },
  { minutes: VIEW_END,   align: "right" },
];

function toViewPct(minutes) {
  return ((minutes - VIEW_START) / VIEW_RANGE) * 100;
}

function segmentsFor(habit) {
  const start = toMinutes(habit.start_time);
  const end = toMinutes(habit.end_time);
  if (start == null || end == null) return [];
  if (end > start) return [[start, end]];
  return [
    [start, DAY_MIN],
    [0, end],
  ];
}

export default function DayRail({ habits, now, completedHabitIds }) {
  const day = now.getDay();
  const nowMinutes = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const nowPct = toViewPct(nowMinutes);
  const nowVisible = nowMinutes >= VIEW_START && nowMinutes <= VIEW_END;

  const todays = habits.filter(
    (h) => h.is_active !== false && parseDays(h.days_of_week).includes(day)
  );

  return (
    <div className="w-full select-none">
      <div className="relative h-3.5 w-full rounded-full bg-panel-alt">
        {todays.map((habit) =>
          segmentsFor(habit).map(([start, end], i) => {
            const meta = categoryMeta(habit.category);
            const done = completedHabitIds.has(habit.id);
            const left = toViewPct(start);
            const width = Math.max(((end - start) / VIEW_RANGE) * 100, 0.6);
            return (
              <div
                key={`${habit.id}-${i}`}
                title={`${habit.name} · ${formatTime(habit.start_time)}–${formatTime(habit.end_time)}`}
                className="absolute top-0 h-3.5 rounded-full"
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  backgroundColor: `var(--${meta.token})`,
                  opacity: done ? 0.4 : 0.85,
                }}
              />
            );
          })
        )}

        {/* Now marker */}
        {nowVisible && (
          <div
            className="absolute -top-1.5 flex -translate-x-1/2 flex-col items-center"
            style={{ left: `${nowPct}%` }}
          >
            <span className="h-2.5 w-2.5 rounded-full bg-coral ring-4 ring-coral/20 motion-safe:animate-pulse" />
            <span className="mt-[3px] h-4 w-px bg-coral" />
          </div>
        )}
      </div>

      {/* Tick labels — cada uno posicionado con el mismo sistema de % que la barra */}
      <div className="relative mt-2 h-3 w-full font-mono text-[10px] text-ink-faint">
        {TICKS.map(({ minutes, align }) => {
          const pct = toViewPct(minutes);
          const hhmm = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
          const transform =
            align === "left" ? "none"
            : align === "right" ? "translateX(-100%)"
            : "translateX(-50%)";
          return (
            <span
              key={minutes}
              className="absolute whitespace-nowrap"
              style={{ left: `${pct}%`, transform }}
            >
              {formatTime(hhmm)}
            </span>
          );
        })}
      </div>
    </div>
  );
}
