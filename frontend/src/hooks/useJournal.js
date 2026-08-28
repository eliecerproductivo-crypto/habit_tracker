import { useCallback, useEffect, useState } from "react";
import api from "../api/client";

export function useJournal() {
  const [entries, setEntries] = useState([]);
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/journal");
      setEntries(res.data.entries);
      setSummaries(res.data.summaries);
    } catch {
      setError("No se pudo cargar el diario.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    // El backend genera resúmenes pendientes en background al abrir el diario.
    // Refrescamos a los 5 s para que aparezcan sin que el usuario recargue la página.
    const timer = setTimeout(() => refresh(), 5000);
    return () => clearTimeout(timer);
  }, [refresh]);

  const saveEntry = async (content, entryDate) => {
    const res = await api.put("/journal/entry", { content, entry_date: entryDate });
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.entry_date === entryDate);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = res.data;
        return updated;
      }
      return [res.data, ...prev];
    });
    return res.data;
  };

  const deleteEntry = async (entryDate) => {
    await api.delete(`/journal/entry/${entryDate}`);
    setEntries((prev) => prev.filter((e) => e.entry_date !== entryDate));
    // Quitar también el resumen del día del estado local
    setSummaries((prev) => prev.filter((s) => s.date_from !== entryDate));
  };

  const getEntry = (dateStr) => entries.find((e) => e.entry_date === dateStr) || null;

  return { entries, summaries, loading, error, refresh, saveEntry, deleteEntry, getEntry };
}
