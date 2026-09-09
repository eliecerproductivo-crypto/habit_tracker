import { createContext, useCallback, useContext, useEffect, useState } from "react";
import api from "../api/client";

const HabitsContext = createContext(null);

/**
 * Provides a single shared fetch of /habits for the whole app.
 * Mount once inside ProtectedApp so every page reads from the same store
 * instead of each page independently fetching /habits on mount.
 */
export function HabitsProvider({ children }) {
  const [habits, setHabits]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get("/habits");
      setHabits(res.data);
    } catch (err) {
      setError(err?.response?.data?.detail || "No se pudieron cargar los hábitos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

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

  return (
    <HabitsContext.Provider
      value={{ habits, loading, error, refresh, setHabits, createHabit, updateHabit, deleteHabit }}
    >
      {children}
    </HabitsContext.Provider>
  );
}

export function useHabitsContext() {
  const ctx = useContext(HabitsContext);
  if (!ctx) throw new Error("useHabitsContext must be used within HabitsProvider");
  return ctx;
}