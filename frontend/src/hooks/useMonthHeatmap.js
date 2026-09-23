import { useCallback, useEffect, useState } from "react";
import api from "../api/client";
import { habitOccursOnDate, todayLocalISODate, toLocalISODate } from "../lib/schedule";

/**
 * Carga los logs del año completo y calcula el estado de cada día.
 * Para weekly_times la evaluación es a nivel de SEMANA (lun-dom):
 *   - Semana terminada con cuota cumplida  → "complete"
 *   - Semana terminada sin cuota           → "failed"
 *   - Semana en curso                      → no penaliza (tratado como "empty" para wt)
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

function mondayOfWeek(isoDate) {
  const d = parseLocalDate(isoDate);
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  return formatLocalDate(d);
}

export function useYearHeatmap(habits) {
  const [days, setDays]       = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const habitsKey = habits?.map((h) =>
    `${h.id}-${h.is_active}-${h.days_of_week}-${h.recurrence_type}-${h.recurrence_times_per_week}-${h.start_date}`
  ).join("|") || "";

  const compute = useCallback(async () => {
    const today = todayLocalISODate();
    const todayDate = parseLocalDate(today);

    const startDate = new Date(todayDate);
    startDate.setFullYear(startDate.getFullYear() - 1);
    startDate.setDate(startDate.getDate() + 1);
    const dateFrom = formatLocalDate(startDate);

    if (!habits || habits.length === 0) {
      setDays(buildEmptyRange(startDate, todayDate));
      return;
    }

    setDays((prev) => {
      if (prev.length === 0) setLoading(true);
      return prev;
    });
    setError(null);

    try {
      const res = await api.get("/logs", { params: { date_from: dateFrom, date_to: today } });

      const logMap = {};
      for (const log of res.data) {
        const dateKey = String(log.date).slice(0, 10);
        if (!logMap[dateKey]) logMap[dateKey] = {};
        logMap[dateKey][log.habit_id] = log.status;
      }

      const weeklyTimesHabits = (habits || []).filter(
        (h) => h.is_active && (h.recurrence_type || "weekly") === "weekly_times"
      );
      const regularHabits = (habits || []).filter(
        (h) => h.is_active && (h.recurrence_type || "weekly") !== "weekly_times"
      );

      // Pre-computar estado por semana para cada habito weekly_times
      // weekStatusByHabit[mondayIso][habitId] = "met" | "failed" | "in_progress"
      const weekStatusByHabit = {};

      for (const h of weeklyTimesHabits) {
        const raw = h.created_at || "";
        const hasZone = raw.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(raw);
        const parsed = new Date(hasZone ? raw : raw + "Z");
        const createdLocal = isNaN(parsed.getTime()) ? dateFrom : toLocalISODate(parsed);
        const effectiveStart = h.start_date ? String(h.start_date).slice(0, 10) : createdLocal;
        const target = h.recurrence_times_per_week ?? 1;

        const startIso = effectiveStart > dateFrom ? effectiveStart : dateFrom;
        const monIso = mondayOfWeek(startIso);
        let weekMon = parseLocalDate(monIso);

        while (weekMon <= todayDate) {
          const monKey = formatLocalDate(weekMon);
          const weekSunD = new Date(weekMon);
          weekSunD.setDate(weekSunD.getDate() + 6);
          const weekSunIso = formatLocalDate(weekSunD);

          let doneCount = 0;
          for (let di = 0; di < 7; di++) {
            const dayD = new Date(weekMon);
            dayD.setDate(dayD.getDate() + di);
            const dayIso = formatLocalDate(dayD);
            if (dayIso < effectiveStart) continue;
            if (dayIso > today) break;
            if (logMap[dayIso]?.[h.id] === "done") doneCount++;
          }

          if (!weekStatusByHabit[monKey]) weekStatusByHabit[monKey] = {};
          if (doneCount >= target) {
            weekStatusByHabit[monKey][h.id] = "met";
          } else if (weekSunIso < today) {
            weekStatusByHabit[monKey][h.id] = "failed";
          } else {
            weekStatusByHabit[monKey][h.id] = "in_progress";
          }

          weekMon.setDate(weekMon.getDate() + 7);
        }
      }

      const result = [];
      let cursor = new Date(startDate);

      while (cursor <= todayDate) {
        const iso = formatLocalDate(cursor);
        const monIso = mondayOfWeek(iso);
        const dayLogs = logMap[iso] || {};

        const scheduledRegular = regularHabits.filter((h) => {
          const raw = h.created_at || "";
          const hasZone = raw.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(raw);
          const parsed = new Date(hasZone ? raw : raw + "Z");
          const createdLocal = isNaN(parsed.getTime()) ? iso : toLocalISODate(parsed);
          const effectiveStart = h.start_date ? String(h.start_date).slice(0, 10) : createdLocal;
          if (iso < effectiveStart) return false;
          return habitOccursOnDate(h, iso);
        });

        const weekSunD = new Date(parseLocalDate(monIso));
        weekSunD.setDate(weekSunD.getDate() + 6);
        const weekSunIso = formatLocalDate(weekSunD);

        const relevantWt = weeklyTimesHabits.filter((h) => {
          const raw = h.created_at || "";
          const hasZone = raw.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(raw);
          const parsed = new Date(hasZone ? raw : raw + "Z");
          const createdLocal = isNaN(parsed.getTime()) ? iso : toLocalISODate(parsed);
          const effectiveStart = h.start_date ? String(h.start_date).slice(0, 10) : createdLocal;
          return effectiveStart <= weekSunIso;
        });

        const hasRegular = scheduledRegular.length > 0;
        const hasWt      = relevantWt.length > 0;

        if (!hasRegular && !hasWt) {
          result.push({ iso, status: "empty" });
          cursor.setDate(cursor.getDate() + 1);
          continue;
        }

        const regularOk = !hasRegular || scheduledRegular.every((h) => {
          const s = dayLogs[h.id];
          return s === "done" || s === "skipped";
        });

        let wtFailed = false;
        let wtAllMet = hasWt;
        for (const h of relevantWt) {
          const ws = weekStatusByHabit[monIso]?.[h.id];
          if (ws === "failed") { wtFailed = true; wtAllMet = false; break; }
          if (ws !== "met") wtAllMet = false;
        }

        let status;
        if (!hasWt) {
          status = regularOk ? "complete" : "failed";
        } else if (!hasRegular) {
          if (wtFailed) status = "failed";
          else if (wtAllMet) status = "complete";
          else status = "empty";
        } else {
          if (!regularOk || wtFailed) status = "failed";
          else if (regularOk && wtAllMet) status = "complete";
          else status = regularOk ? "complete" : "failed";
        }

        result.push({ iso, status });
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
