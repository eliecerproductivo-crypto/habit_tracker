import { useCallback, useEffect, useState } from "react";
import api from "../api/client";
import { todayLocalISODate, weekMondayOf, addDays } from "../lib/schedule";

/**
 * Fetches /logs for a specific date AND the full Mon–Sun week containing that
 * date. The week logs are used by TodayChecklist to compute weekly quota
 * progress for weekly_times habits.
 *
 * Dashboard uses this alongside useHabitsContext() to avoid a duplicate
 * /habits fetch — habits come from shared context, logs are per-date local.
 */
export function useDayLogs(date) {
  const targetDate = date || todayLocalISODate();

  const [logs, setLogs]           = useState([]);
  const [weekLogs, setWeekLogs]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Fetch the selected day's logs
      const dayRes = await api.get("/logs", { params: { date: targetDate } });
      setLogs(dayRes.data);

      // Fetch the whole week (Mon–Sun) so weekly_times quota is accurate.
      const monday = weekMondayOf(targetDate);
      const sunday = addDays(monday, 6);
      const weekRes = await api.get("/logs", {
        params: { date_from: monday, date_to: sunday },
      });
      setWeekLogs(weekRes.data);
    } catch (err) {
      setError(err?.response?.data?.detail || "No se pudo cargar la información.");
    } finally {
      setLoading(false);
    }
  }, [targetDate]);

  useEffect(() => { refresh(); }, [refresh]);

  // { habitId: log } for the selected day
  const logsByHabitId = Object.fromEntries(logs.map((l) => [l.habit_id, l]));

  // { habitId: { isoDate: log } } for the full week — used by TodayChecklist
  // for weekly_times habits.
  const weekLogsByHabitId = {};
  for (const log of weekLogs) {
    const iso = log.date ? String(log.date).slice(0, 10) : null;
    if (!iso) continue;
    if (!weekLogsByHabitId[log.habit_id]) weekLogsByHabitId[log.habit_id] = {};
    weekLogsByHabitId[log.habit_id][iso] = log;
  }

  const completedHabitIds = new Set(
    logs.filter((l) => l.status === "done").map((l) => l.habit_id)
  );

  const setHabitStatus = async (habitId, status, extra = {}) => {
    if (status === null) {
      const existing = logsByHabitId[habitId];
      if (!existing) return;
      // Optimistic remove
      setLogs((prev) => prev.filter((l) => l.habit_id !== habitId));
      setWeekLogs((prev) => prev.filter(
        (l) => !(l.habit_id === habitId && String(l.date).slice(0, 10) === targetDate)
      ));
      try {
        await api.delete(`/logs/${existing.id}`);
      } catch (err) {
        // Revert on failure
        setLogs((prev) => [...prev, existing]);
        refresh();
        throw err;
      }
      return;
    }

    const payload = {
      habit_id: habitId,
      date: targetDate,
      status,
      ...(extra.mood !== undefined ? { mood: extra.mood } : {}),
      ...(extra.note !== undefined ? { note: extra.note } : {}),
    };

    // Optimistic update for both day and week state
    const optimistic = {
      ...payload,
      id: logsByHabitId[habitId]?.id ?? `temp_${Date.now()}`,
      logged_at: new Date().toISOString(),
    };
    const prevLogs     = logs;
    const prevWeekLogs = weekLogs;
    setLogs([...logs.filter((l) => l.habit_id !== habitId), optimistic]);
    setWeekLogs([
      ...weekLogs.filter(
        (l) => !(l.habit_id === habitId && String(l.date).slice(0, 10) === targetDate)
      ),
      optimistic,
    ]);

    try {
      const res = await api.post("/logs", payload);
      setLogs((prev) => [
        ...prev.filter((l) => l.habit_id !== habitId),
        res.data,
      ]);
      setWeekLogs((prev) => [
        ...prev.filter(
          (l) => !(l.habit_id === habitId && String(l.date).slice(0, 10) === targetDate)
        ),
        res.data,
      ]);
      return res.data;
    } catch (err) {
      // Revert on failure
      setLogs(prevLogs);
      setWeekLogs(prevWeekLogs);
      throw err;
    }
  };

  return {
    logs,
    logsByHabitId,
    weekLogsByHabitId,
    completedHabitIds,
    loading,
    error,
    refresh,
    setHabitStatus,
    toggleToday: (habitId, completed) =>
      setHabitStatus(habitId, completed ? "done" : null),
    date: targetDate,
  };
}
