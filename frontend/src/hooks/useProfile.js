import { useCallback, useEffect, useState } from "react";
import api from "../api/client";

export function useProfile() {
  const [bio, setBio] = useState("");
  const [bioSummary, setBioSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("/profile");
      setBio(res.data.bio || "");
      setBioSummary(res.data.bio_summary || null);
    } catch {
      setError("No se pudo cargar el perfil.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const saveBio = async (text) => {
    const res = await api.put("/profile", { bio: text });
    setBio(res.data.bio);
    setBioSummary(res.data.bio_summary);
    return res.data;
  };

  const summarizeBio = async () => {
    const res = await api.post("/profile/summarize");
    setBio(res.data.bio);
    setBioSummary(res.data.bio_summary);
    return res.data;
  };

  return { bio, bioSummary, loading, error, saveBio, summarizeBio };
}
