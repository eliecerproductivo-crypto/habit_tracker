import { useState } from "react";
import CurrentFocusCard from "../components/CurrentFocusCard";
import TodayChecklist from "../components/TodayChecklist";
import StatCard from "../components/StatCard";
import DateNavBar from "../components/DateNavBar";
import { useHabits } from "../hooks/useHabits";
import { useStats } from "../hooks/useStats";
import { parseDays, todayLocalISODate, toLocalISODate, weekdayOfISODate } from "../lib/schedule";

export default function Dashboard() {
  const [selectedDate, setSelectedDate] = useState(todayLocalISODate());
  const { habits: allHabits, completedHabitIds, logsByHabitId, loading, error, setHabitStatus } = useHabits(selectedDate);
  const { summary } = useStats();

  // Excluir hábitos que no existían en la fecha seleccionada.
  // created_at viene del backend en UTC (sin sufijo de zona), así que hay que
  // convertirlo a fecha local antes de comparar, para evitar que un hábito
  // creado de noche aparezca como "del día siguiente".
  const habits = allHabits.filter((h) => {
    const createdLocal = toLocalISODate(new Date(h.created_at + "Z")); // "Z" fuerza parsing como UTC
    return createdLocal <= selectedDate;
  });

  const isToday = selectedDate === todayLocalISODate();
  const weekday = weekdayOfISODate(selectedDate);
  const scheduledToday = habits.filter(
    (h) => h.is_active !== false && parseDays(h.days_of_week).includes(weekday)
  );
  const doneToday = scheduledToday.filter((h) => completedHabitIds.has(h.id)).length;
  const pct = scheduledToday.length ? Math.round((doneToday / scheduledToday.length) * 100) : 0;

  return (
    <div className="flex flex-col gap-6">
      <DateNavBar date={selectedDate} onChange={setSelectedDate} />

      {loading ? (
        <p className="text-sm text-ink-soft">Cargando…</p>
      ) : error ? (
        <p className="rounded-lg bg-coral-soft px-4 py-3 text-sm text-coral">{error}</p>
      ) : (
        <>
          <CurrentFocusCard
            habits={habits}
            logsByHabitId={logsByHabitId}
            onSetStatus={setHabitStatus}
            date={selectedDate}
          />

          <div className="grid grid-cols-3 gap-3">
            <StatCard
              label={isToday ? "Hoy" : "Ese día"}
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
              {isToday ? "Plan de hoy" : "Plan de ese día"}
            </h2>
            <TodayChecklist
              habits={habits}
              logsByHabitId={logsByHabitId}
              onSetStatus={setHabitStatus}
              date={selectedDate}
            />
          </div>
        </>
      )}
    </div>
  );
}
