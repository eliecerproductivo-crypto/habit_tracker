import { useCallback, useEffect, useState } from "react";
import api from "../api/client";

/**
 * Hook para gestionar los comodines de hábito (descanso individual por quincena).
 *
 * Expone:
 *   status          – HabitWildcardStatus del backend (o null si cargando)
 *   loading         – boolean
 *   error           – string | null
 *   refresh()       – recarga el estado de cuota desde el servidor
 *   checkHabit(id)  – consulta si un hábito concreto puede descansar hoy
 *                     y guarda el resultado en habitStatuses[id]
 *   useRest(habitId) – usa 1 comodín para el hábito (solo hoy)
 *                      retorna { log, status } o lanza excepción
 *   undoRest(habitId) – deshace el descanso de hoy si aún no pasó el día
 *   habitStatuses   – { [habitId]: HabitWildcardStatus } — cache per-habit
 */
export function useHabitWildcard() {
  const [status, setStatus]             = useState(null);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [habitStatuses, setHabitStatuses] = useState({});

  const refresh = useCallback(async () => {
    try {
      const res = await api.get("/habit-wildcards");
      setStatus(res.data);
    } catch (err) {
      setError(err?.response?.data?.detail || "No se pudo cargar los comodines de hábito.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  /**
   * Consulta la disponibilidad del comodín para un hábito concreto.
   * Guarda el resultado en habitStatuses[habitId].
   */
  const checkHabit = useCallback(async (habitId) => {
    try {
      const res = await api.get(`/habit-wildcards/check/${habitId}`);
      setHabitStatuses((prev) => ({ ...prev, [habitId]: res.data }));
      return res.data;
    } catch {
      // silencioso — el botón simplemente no cambia a activo
    }
  }, []);

  /**
   * Usa 1 comodín de hábito para el hábito indicado (solo hoy).
   * Lanza excepción si el backend rechaza (cuota agotada, consecutivo, etc.)
   */
  const useRest = useCallback(async (habitId) => {
    const today = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD en timezone local
    const res = await api.post("/habit-wildcards/use", {
      habit_id: habitId,
      date: today,
    });
    // Actualizar estado global y el de este hábito
    setStatus(res.data.status);
    setHabitStatuses((prev) => ({ ...prev, [habitId]: res.data.status }));
    return res.data;
  }, []);

  /**
   * Deshace el descanso del hábito de hoy.
   * Devuelve el nuevo HabitWildcardStatus actualizado.
   */
  const undoRest = useCallback(async (habitId) => {
    const res = await api.delete(`/habit-wildcards/undo/${habitId}`);
    setStatus(res.data);
    setHabitStatuses((prev) => ({ ...prev, [habitId]: res.data }));
    return res.data;
  }, []);

  return { status, loading, error, refresh, checkHabit, useRest, undoRest, habitStatuses };
}
