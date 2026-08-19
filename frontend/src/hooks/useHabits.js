import { useCallback, useEffect, useState } from "react";
import api from "../api/client";
import { todayLocalISODate } from "../lib/schedule";

export function useHabits() {
  const [habits, setHabits] = useState([]);
  const [logs, setLogs] = useState([]); // today's logs
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const today = todayLocalISODate();

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [habitsRes, logsRes] = await Promise.all([
        api.get("/habits"),
        api.get("/logs", { params: { date: today } }),
      ]);
      setHabits(habitsRes.data);
      setLogs(logsRes.data);
    } catch (err) {
      setError(err?.response?.data?.detail || "No se pudo cargar la información.");
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const completedHabitIds = new Set(
    logs.filter((l) => l.completed).map((l) => l.habit_id)
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

  const toggleToday = async (habitId, completed) => {
    const res = await api.post("/logs", {
      habit_id: habitId,
      date: today,
      completed,
    });
    setLogs((prev) => {
      const rest = prev.filter((l) => l.habit_id !== habitId);
      return [...rest, res.data];
    });
  };

  return {
    habits,
    logs,
    completedHabitIds,
    loading,
    error,
    refresh,
    createHabit,
    updateHabit,
    deleteHabit,
    toggleToday,
    today,
  };
}
