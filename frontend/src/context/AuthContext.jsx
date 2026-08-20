import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api, { getToken, setToken, setUnauthorizedHandler } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const res = await api.get("/auth/me");
      setUser(res.data);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    loadMe();
  }, [loadMe]);

  const login = async (email, password) => {
    const form = new URLSearchParams();
    form.set("username", email);
    form.set("password", password);
    const res = await api.post("/auth/login", form, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    setToken(res.data.access_token);
    await loadMe();
  };

  const register = async (name, email, password) => {
    await api.post("/auth/register", { name, email, password });
    await login(email, password);
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  const updateProfile = async (name, email) => {
    const res = await api.put("/auth/me", { name, email });
    setUser(res.data);
    return res.data;
  };

  const changePassword = async (currentPassword, newPassword) => {
    await api.put("/auth/me/password", {
      current_password: currentPassword,
      new_password: newPassword,
    });
  };

  const deleteAccount = async () => {
    await api.delete("/auth/me");
    logout();
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, login, register, logout, updateProfile, changePassword, deleteAccount }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
