import { useCallback, useEffect, useState } from "react";
import api from "../api/client";

/**
 * Carga las estadísticas detalladas de un hábito individual.
 * Solo hace la llamada cuando habitId es un número válido.
 */
export function useHabitStats(habitId) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const fetch = useCallback(async () => {
    if (!habitId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/stats/habit/${habitId}`);
      setData(res.data);
    } catch (err) {
      setError(err?.response?.data?.detail || "No se pudieron cargar las estadísticas.");
    } finally {
      setLoading(false);
    }
  }, [habitId]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, error, refresh: fetch };
}
