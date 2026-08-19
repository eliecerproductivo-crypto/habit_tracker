import CurrentFocusCard from "../components/CurrentFocusCard";
import TodayChecklist from "../components/TodayChecklist";
import StatCard from "../components/StatCard";
import { useHabits } from "../hooks/useHabits";
import { useStats } from "../hooks/useStats";
import { parseDays } from "../lib/schedule";

export default function Dashboard() {
  const { habits, completedHabitIds, loading, error, toggleToday } = useHabits();
  const { summary } = useStats();

  const today = new Date().getDay();
  const scheduledToday = habits.filter(
    (h) => h.is_active !== false && parseDays(h.days_of_week).includes(today)
  );
  const doneToday = scheduledToday.filter((h) => completedHabitIds.has(h.id)).length;
  const pct = scheduledToday.length
    ? Math.round((doneToday / scheduledToday.length) * 100)
    : 0;

  if (loading) {
    return <p className="text-sm text-ink-soft">Cargando tu día…</p>;
  }

  if (error) {
    return <p className="rounded-lg bg-coral-soft px-4 py-3 text-sm text-coral">{error}</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <CurrentFocusCard
        habits={habits}
        completedHabitIds={completedHabitIds}
        onToggle={toggleToday}
      />

      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="Hoy"
          value={`${pct}%`}
          sublabel={`${doneToday} / ${scheduledToday.length} bloques`}
          accent="signal"
        />
        <StatCard
          label="Racha actual"
          value={summary ? summary.current_streak : "—"}
          sublabel="días seguidos"
          accent="mint"
        />
        <StatCard
          label="Esta semana"
          value={summary ? `${summary.week_completion_rate}%` : "—"}
          sublabel="cumplimiento"
          accent="violet"
        />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-ink-soft">
          Plan de hoy
        </h2>
        <TodayChecklist
          habits={habits}
          completedHabitIds={completedHabitIds}
          onToggle={toggleToday}
        />
      </div>
    </div>
  );
}
