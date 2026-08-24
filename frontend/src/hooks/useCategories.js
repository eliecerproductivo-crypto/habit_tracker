import { useCallback, useEffect, useState } from "react";
import api from "../api/client";

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

  return { categories, displayCategories: categories, loading, addCategory, deleteCategory, refresh };
}
