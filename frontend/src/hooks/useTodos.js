import { useCallback, useEffect, useState } from "react";
import api from "../api/client";

export function useTodos() {
  const [todos, setTodos]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await api.get("/todos");
      setTodos(res.data);
      setError(null);
    } catch (err) {
      setError("No se pudieron cargar las tareas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const addTodo = async ({ text, due_date = null, priority = null }) => {
    const res = await api.post("/todos", { text, due_date, priority });
    setTodos((prev) => [res.data, ...prev]);
    return res.data;
  };

  const toggleDone = async (id) => {
    const item = todos.find((t) => t.id === id);
    if (!item) return;
    // Optimistic update
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    );
    try {
      const res = await api.patch(`/todos/${id}`, { done: !item.done });
      setTodos((prev) => prev.map((t) => (t.id === res.data.id ? res.data : t)));
    } catch {
      // Revert on failure
      setTodos((prev) =>
        prev.map((t) => (t.id === id ? { ...t, done: item.done } : t))
      );
    }
  };

  const updateTodo = async (id, changes) => {
    const res = await api.patch(`/todos/${id}`, changes);
    setTodos((prev) => prev.map((t) => (t.id === res.data.id ? res.data : t)));
    return res.data;
  };

  const deleteTodo = async (id) => {
    setTodos((prev) => prev.filter((t) => t.id !== id));
    try {
      await api.delete(`/todos/${id}`);
    } catch {
      load(); // revert on failure
    }
  };

  const clearDone = async () => {
    setTodos((prev) => prev.filter((t) => !t.done));
    try {
      await api.delete("/todos");
    } catch {
      load();
    }
  };

  // Split into pending and done for easy rendering
  const pending = todos.filter((t) => !t.done);
  const done    = todos.filter((t) => t.done);

  return { todos, pending, done, loading, error, addTodo, toggleDone, updateTodo, deleteTodo, clearDone, refresh: load };
}
