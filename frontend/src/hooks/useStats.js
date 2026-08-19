import { useCallback, useEffect, useState } from "react";
import api from "../api/client";

export function useStats() {
  const [summary, setSummary] = useState(null);
  const [weekly, setWeekly] = useState([]);
  const [byCategory, setByCategory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [summaryRes, weeklyRes, categoryRes] = await Promise.all([
        api.get("/stats/summary"),
        api.get("/stats/weekly"),
        api.get("/stats/by-category"),
      ]);
      setSummary(summaryRes.data);
      setWeekly(weeklyRes.data);
      setByCategory(categoryRes.data);
    } catch (err) {
      setError(err?.response?.data?.detail || "No se pudieron cargar las estadísticas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { summary, weekly, byCategory, loading, error, refresh };
}
