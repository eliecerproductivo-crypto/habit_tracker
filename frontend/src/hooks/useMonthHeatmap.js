import { useCallback, useEffect, useState } from "react";
import api from "../api/client";
import { habitOccursOnDate, todayLocalISODate, toLocalISODate } from "../lib/schedule";

/**
 * Carga los logs del año completo (desde hace 12 meses hasta hoy) y calcula
 * el estado de cada día:
 *   "complete" → todos los hábitos programados ese día están done o skipped
 *   "failed"   → al menos uno sin registrar (o failed)
 *   "empty"    → ningún hábito programado ese día
 *   "future"   → día aún no ha llegado
 */
export function useYearHeatmap(habits) {
  const [days, setDays]       = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const compute = useCallback(async () => {
    const today = todayLocalISODate();

    // 12 meses hacia atrás
    const startDate = new Date(today);
    startDate.setFullYear(startDate.getFullYear() - 1);
    startDate.setDate(startDate.getDate() + 1);
    const dateFrom = toLocalISODate(startDate);

    if (!habits || habits.length === 0) {
      setDays(buildEmptyRange(dateFrom, today));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.get("/logs", { params: { date_from: dateFrom, date_to: today } });

      // Índice: { "YYYY-MM-DD": { habitId: status } }
      const logMap = {};
      for (const log of res.data) {
        if (!logMap[log.date]) logMap[log.date] = {};
        logMap[log.date][log.habit_id] = log.status;
      }

      const result = [];
      let cursor = new Date(startDate);
      const todayDate = new Date(today);

      while (cursor <= todayDate) {
        const iso = toLocalISODate(cursor);

        const scheduled = habits.filter((h) => {
          if (!h.is_active) return false;
          const raw = h.created_at || "";
          const hasZone = raw.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(raw);
          const parsed = new Date(hasZone ? raw : raw + "Z");
          const createdLocal = isNaN(parsed.getTime()) ? iso : toLocalISODate(parsed);
          const effectiveStart = h.start_date ? String(h.start_date).slice(0, 10) : createdLocal;
          if (iso < effectiveStart) return false;
          return habitOccursOnDate(h, iso);
        });

        if (scheduled.length === 0) {
          result.push({ iso, status: "empty" });
        } else {
          const dayLogs = logMap[iso] || {};
          const allOk = scheduled.every((h) => {
            const s = dayLogs[h.id];
            return s === "done" || s === "skipped";
          });
          result.push({ iso, status: allOk ? "complete" : "failed" });
        }

        cursor.setDate(cursor.getDate() + 1);
      }

      setDays(result);
    } catch (err) {
      setError(err?.response?.data?.detail || "Error al cargar el heatmap.");
    } finally {
      setLoading(false);
    }
  }, [habits]);

  useEffect(() => { compute(); }, [compute]);

  return { days, loading, error };
}

function buildEmptyRange(dateFrom, dateTo) {
  const result = [];
  const cursor = new Date(dateFrom);
  const end    = new Date(dateTo);
  while (cursor <= end) {
    result.push({ iso: toLocalISODate(cursor), status: "empty" });
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}
