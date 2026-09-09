import { useCallback, useEffect, useState } from "react";
import api from "../api/client";
import { todayLocalISODate } from "../lib/schedule";

/**
 * Fetches only the /logs for a specific date.
 * Dashboard uses this alongside useHabitsContext() to avoid a duplicate
 * /habits fetch — habits come from shared context, logs are per-date local.
 */
export function useDayLogs(date) {
  const targetDate = date || todayLocalISODate();

  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/logs", { params: { date: targetDate } });
      setLogs(res.data);
    } catch (err) {
      setError(err?.response?.data?.detail || "No se pudo cargar la información.");
    } finally {
      setLoading(false);
    }
  }, [targetDate]);

  useEffect(() => { refresh(); }, [refresh]);

  const logsByHabitId = Object.fromEntries(logs.map((l) => [l.habit_id, l]));
  const completedHabitIds = new Set(
    logs.filter((l) => l.status === "done").map((l) => l.habit_id)
  );

  const setHabitStatus = async (habitId, status, extra = {}) => {
    if (status === null) {
      const existing = logsByHabitId[habitId];
      if (!existing) return;
      // Optimistic remove
      setLogs((prev) => prev.filter((l) => l.habit_id !== habitId));
      try {
        await api.delete(`/logs/${existing.id}`);
      } catch (err) {
        // Revert on failure
        setLogs((prev) => [...prev, existing]);
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

    // Optimistic update
    const optimistic = {
      ...payload,
      id: logsByHabitId[habitId]?.id ?? `temp_${Date.now()}`,
      logged_at: new Date().toISOString(),
    };
    const prevLogs = logs;
    setLogs([...logs.filter((l) => l.habit_id !== habitId), optimistic]);

    try {
      const res = await api.post("/logs", payload);
      setLogs((prev) => [
        ...prev.filter((l) => l.habit_id !== habitId),
        res.data,
      ]);
      return res.data;
    } catch (err) {
      // Revert on failure
      setLogs(prevLogs);
      throw err;
    }
  };

  return {
    logs,
    logsByHabitId,
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