import { useCallback, useEffect, useState } from "react";
import api from "../api/client";

/**
 * Hook para gestionar el estado de comodines del usuario.
 *
 * Expone:
 *   wildcard     – objeto WildcardStatus del backend (o null si cargando)
 *   loading      – boolean
 *   error        – string | null
 *   refresh()    – recarga el estado desde el servidor
 *   checkMilestone() – llama a POST /wildcards/check-milestone tras registrar hábitos
 *   useWildcardForDate(date) – gasta 1 comodín para la fecha indicada (YYYY-MM-DD)
 *   gained       – true durante 4 s cuando se acaba de ganar un comodín (para toast)
 */
export function useWildcard() {
  const [wildcard, setWildcard] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [gained, setGained]     = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await api.get("/wildcards");
      setWildcard(res.data);
    } catch (err) {
      setError(err?.response?.data?.detail || "No se pudo cargar los comodines.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  /**
   * Llama al endpoint de milestone. Si el balance subió, dispara `gained`
   * para que el componente muestre una notificación de celebración.
   */
  const checkMilestone = useCallback(async () => {
    try {
      const prevBalance = wildcard?.balance ?? 0;
      const res = await api.post("/wildcards/check-milestone");
      setWildcard(res.data);
      if (res.data.balance > prevBalance) {
        setGained(true);
        setTimeout(() => setGained(false), 4000);
      }
    } catch {
      // silencioso — no bloquear al usuario si falla
    }
  }, [wildcard]);

  /**
   * Usa 1 comodín para la fecha dada (formato "YYYY-MM-DD").
   * Lanza excepción si el backend rechaza (sin saldo, consecutivo, etc.)
   * para que el componente pueda mostrar el error.
   */
  const useWildcardForDate = useCallback(async (date) => {
    const res = await api.post("/wildcards/use", { date });
    setWildcard(res.data);
    return res.data;
  }, []);

  return { wildcard, loading, error, gained, refresh, checkMilestone, useWildcardForDate };
}
