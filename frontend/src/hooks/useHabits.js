import { useCallback, useEffect, useState } from "react";
import api from "../api/client";
import { todayLocalISODate } from "../lib/schedule";

export function useHabits(date) {
  const [habits, setHabits] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const targetDate = date || todayLocalISODate();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [habitsRes, logsRes] = await Promise.all([
        api.get("/habits"),
        api.get("/logs", { params: { date: targetDate } }),
      ]);
      setHabits(habitsRes.data);
      setLogs(logsRes.data);
    } catch (err) {
      setError(err?.response?.data?.detail || "No se pudo cargar la información.");
    } finally {
      setLoading(false);
    }
  }, [targetDate]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Map habit_id -> status ("done" | "skipped" | "failed") for logged habits
  const logsByHabitId = Object.fromEntries(logs.map((l) => [l.habit_id, l]));

  // Keep a simple Set for components that only need to know if done
  const completedHabitIds = new Set(
    logs.filter((l) => l.status === "done").map((l) => l.habit_id)
  );

  const createHabit = async (payload) => {
    const res = await api.post("/habits", payload);
    setHabits((h) => [...h, res.data]);
    return res.data;
  };

  const updateHabit = async (id, payload) => {
    const res = await api.put(`/habits/${id}`, payload);
    setHabits((h) => h.map((x) => (x.id === id ? res.data : x)));
    return res.data;
  };

  const deleteHabit = async (id) => {
    await api.delete(`/habits/${id}`);
    setHabits((h) => h.filter((x) => x.id !== id));
  };

  /**
   * Set the status for a habit on the target date.
   * status: "done" | "skipped" | "failed"
   * Passing null clears the log entirely (back to "sin registrar").
   */
  const setHabitStatus = async (habitId, status) => {
    if (status === null) {
      // Find the log id and delete it
      const existing = logsByHabitId[habitId];
      if (existing) {
        await api.delete(`/logs/${existing.id}`);
        setLogs((prev) => prev.filter((l) => l.habit_id !== habitId));
      }
      return;
    }

    const res = await api.post("/logs", {
      habit_id: habitId,
      date: targetDate,
      status,
    });
    setLogs((prev) => {
      const rest = prev.filter((l) => l.habit_id !== habitId);
      return [...rest, res.data];
    });
  };

  return {
    habits,
    logs,
    logsByHabitId,
    completedHabitIds,
    loading,
    error,
    refresh,
    createHabit,
    updateHabit,
    deleteHabit,
    setHabitStatus,
    // legacy alias so nothing else breaks during the transition
    toggleToday: (habitId, completed) =>
      setHabitStatus(habitId, completed ? "done" : null),
    date: targetDate,
  };
}
