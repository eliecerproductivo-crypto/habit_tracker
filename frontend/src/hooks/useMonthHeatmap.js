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
function parseLocalDate(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

function formatLocalDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function useYearHeatmap(habits) {
  const [days, setDays]       = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  // Clave estable para evitar refetches si la referencia del array cambia pero los hábitos son los mismos
  const habitsKey = habits?.map((h) => `${h.id}-${h.is_active}-${h.days_of_week}`).join("|") || "";

  const compute = useCallback(async () => {
    const today = todayLocalISODate();
    const todayDate = parseLocalDate(today);

    // 12 meses hacia atrás (usando mediodía local para evitar desfases de zona horaria)
    const startDate = new Date(todayDate);
    startDate.setFullYear(startDate.getFullYear() - 1);
    startDate.setDate(startDate.getDate() + 1);
    const dateFrom = formatLocalDate(startDate);

    if (!habits || habits.length === 0) {
      setDays(buildEmptyRange(startDate, todayDate));
      return;
    }

    // Solo activamos loading en la primera carga (cuando aún no hay días dibujados)
    // para que las actualizaciones posteriores se hagan en segundo plano sin parpadear
    setDays((prev) => {
      if (prev.length === 0) setLoading(true);
      return prev;
    });
    setError(null);

    try {
      const res = await api.get("/logs", { params: { date_from: dateFrom, date_to: today } });

      // Índice: { "YYYY-MM-DD": { habitId: status } }
      const logMap = {};
      for (const log of res.data) {
        // Normalizar a YYYY-MM-DD por si llega con hora
        const dateKey = String(log.date).slice(0, 10);
        if (!logMap[dateKey]) logMap[dateKey] = {};
        logMap[dateKey][log.habit_id] = log.status;
      }

      const result = [];
      let cursor = new Date(startDate);

      while (cursor <= todayDate) {
        const iso = formatLocalDate(cursor);

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
  }, [habitsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { compute(); }, [compute]);

  return { days, loading, error };
}

function buildEmptyRange(startDate, todayDate) {
  const result = [];
  const cursor = new Date(startDate);
  while (cursor <= todayDate) {
    result.push({ iso: formatLocalDate(cursor), status: "empty" });
    cursor.setDate(cursor.getDate() + 1);
  }
  return result;
}
