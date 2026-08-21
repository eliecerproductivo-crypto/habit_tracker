import { useCallback, useEffect, useState } from "react";
import api from "../api/client";

const DEFAULT_CATEGORIES = ["Trabajo", "Estudio", "Salud", "Personal", "Organizar"];

export function useCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/categories");
      setCategories(res.data);
    } catch {
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const addCategory = async (name) => {
    const res = await api.post("/categories", { name });
    setCategories((prev) => {
      if (prev.find((c) => c.id === res.data.id)) return prev;
      return [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name));
    });
    return res.data;
  };

  const deleteCategory = async (id) => {
    await api.delete(`/categories/${id}`);
    setCategories((prev) => prev.filter((c) => c.id !== id));
  };

  // If user has no custom categories, show defaults
  const displayCategories = categories.length > 0
    ? categories
    : DEFAULT_CATEGORIES.map((name, i) => ({ id: -(i + 1), name }));

  return { categories, displayCategories, loading, addCategory, deleteCategory, refresh };
}
