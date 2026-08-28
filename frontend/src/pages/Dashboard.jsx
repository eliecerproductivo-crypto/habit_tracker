import { useState } from "react";
import CurrentFocusCard from "../components/CurrentFocusCard";
import TodayChecklist from "../components/TodayChecklist";
import StatCard from "../components/StatCard";
import DateNavBar from "../components/DateNavBar";
import { useHabits } from "../hooks/useHabits";
import { useStats } from "../hooks/useStats";
import { todayLocalISODate, toLocalISODate, habitOccursOnDate } from "../lib/schedule";

export default function Dashboard() {
  const [selectedDate, setSelectedDate] = useState(todayLocalISODate());
  const { habits: allHabits, completedHabitIds, logsByHabitId, loading, error, setHabitStatus, refresh: refreshHabits } = useHabits(selectedDate);
  const { summary, refresh: refreshStats } = useStats();

  // Wrapper que actualiza el estado del hábito y luego refresca las stats
  const handleSetStatus = async (habitId, status) => {
    await setHabitStatus(habitId, status);
    refreshStats();
  };

  // Excluir hábitos que no existían en la fecha seleccionada.
  // created_at viene del backend en UTC (sin sufijo de zona), así que hay que
  // convertirlo a fecha local antes de comparar, para evitar que un hábito
  // creado de noche aparezca como "del día siguiente".
  const habits = allHabits.filter((h) => {
    // created_at puede venir como "2026-08-20T15:30:00" (SQLite, sin zona)
    // o como "2026-08-20T15:30:00+00:00" / "2026-08-20T15:30:00Z" (Postgres, con zona).
    // Normalizamos: si no tiene info de zona, agregamos "Z" para forzar UTC.
    // Si ya la tiene, la usamos tal cual.
    const raw = h.created_at || "";
    const hasZone = raw.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(raw);
    const parsed = new Date(hasZone ? raw : raw + "Z");
    if (isNaN(parsed.getTime())) return true; // si no se puede parsear, incluir el hábito
    const createdLocal = toLocalISODate(parsed);
    // Si tiene start_date explícita, usarla como límite; si no, usar created_at
    const effectiveStart = h.start_date
      ? String(h.start_date).slice(0, 10)
      : createdLocal;
    return effectiveStart <= selectedDate;
  });

  const isToday = selectedDate === todayLocalISODate();
  const scheduledToday = habits.filter(
    (h) => h.is_active !== false && habitOccursOnDate(h, selectedDate)
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
            onSetStatus={handleSetStatus}
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
              onSetStatus={handleSetStatus}
              date={selectedDate}
            />
          </div>
        </>
      )}
    </div>
  );
}
