import { useCallback, useEffect, useState } from "react";
import { get, set } from "idb-keyval";
import api from "../api/client";
import { todayLocalISODate } from "../lib/schedule";
import { enqueueLog, syncOfflineQueue } from "../lib/offlineQueue";

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

      // ── Guardar en caché local para uso offline ────────────────────────
      await set("cached_habits", habitsRes.data);
      await set(`cached_logs_${targetDate}`, logsRes.data);

      setHabits(habitsRes.data);
      setLogs(logsRes.data);

      // Aprovechar la reconexión para vaciar la cola pendiente
      syncOfflineQueue().catch(() => {});
    } catch (err) {
      const isOffline =
        !navigator.onLine ||
        err.code === "ERR_NETWORK" ||
        err.code === "ECONNABORTED" ||
        !err.response;

      if (isOffline) {
        // ── Modo offline: leer desde IndexedDB ────────────────────────────
        const localHabits = (await get("cached_habits")) || [];
        const localLogs   = (await get(`cached_logs_${targetDate}`)) || [];
        setHabits(localHabits);
        setLogs(localLogs);
        setError("Sin conexión — mostrando datos guardados localmente.");
      } else {
        setError(err?.response?.data?.detail || "No se pudo cargar la información.");
      }
    } finally {
      setLoading(false);
    }
  }, [targetDate]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Map habit_id -> log completo
  const logsByHabitId = Object.fromEntries(logs.map((l) => [l.habit_id, l]));

  // Set de IDs con status "done"
  const completedHabitIds = new Set(
    logs.filter((l) => l.status === "done").map((l) => l.habit_id)
  );

  const createHabit = async (payload) => {
    const res = await api.post("/habits", payload);
    setHabits((h) => [...h, res.data]);
    // Actualizar caché
    const updated = [...habits, res.data];
    set("cached_habits", updated).catch(() => {});
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
   * Marca o desmarca un hábito para la fecha objetivo.
   * - Offline: actualiza la UI optimistamente y encola la acción.
   * - Online: envía al servidor normalmente; si falla por red, encola.
   */
  const setHabitStatus = async (habitId, status, extra = {}) => {
    if (status === null) {
      // ── Desmarcar (eliminar log) ─────────────────────────────────────────
      const existing = logsByHabitId[habitId];
      if (!existing) return;

      // Actualización optimista
      setLogs((prev) => prev.filter((l) => l.habit_id !== habitId));

      if (!navigator.onLine) {
        await enqueueLog({ type: "delete", payload: { log_id: existing.id } });
        return;
      }
      try {
        await api.delete(`/logs/${existing.id}`);
      } catch (err) {
        const isNetworkError = !err.response || err.code === "ERR_NETWORK";
        if (isNetworkError) {
          await enqueueLog({ type: "delete", payload: { log_id: existing.id } });
        } else {
          // Revertir si el servidor rechazó
          setLogs((prev) => [...prev, existing]);
          throw err;
        }
      }
      return;
    }

    // ── Upsert log ──────────────────────────────────────────────────────────
    const payload = {
      habit_id: habitId,
      date: targetDate,
      status,
      ...(extra.mood !== undefined ? { mood: extra.mood } : {}),
      ...(extra.note !== undefined ? { note: extra.note } : {}),
    };

    // Actualización optimista de la UI
    const optimistic = {
      ...payload,
      id: logsByHabitId[habitId]?.id ?? `offline_${Date.now()}`,
      logged_at: new Date().toISOString(),
    };
    setLogs((prev) => {
      const rest = prev.filter((l) => l.habit_id !== habitId);
      return [...rest, optimistic];
    });

    if (!navigator.onLine) {
      await enqueueLog({ type: "upsert", payload });
      return optimistic;
    }

    try {
      const res = await api.post("/logs", payload);
      // Reemplazar el optimista con la respuesta real del servidor
      setLogs((prev) => {
        const rest = prev.filter((l) => l.habit_id !== habitId);
        return [...rest, res.data];
      });
      return res.data;
    } catch (err) {
      const isNetworkError = !err.response || err.code === "ERR_NETWORK";
      if (isNetworkError) {
        await enqueueLog({ type: "upsert", payload });
        return optimistic;
      }
      // Error real del servidor → revertir UI
      setLogs((prev) => prev.filter((l) => l.habit_id !== habitId));
      throw err;
    }
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
    toggleToday: (habitId, completed) =>
      setHabitStatus(habitId, completed ? "done" : null),
    date: targetDate,
  };
}
