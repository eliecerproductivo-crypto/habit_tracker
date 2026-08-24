import { useState } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import api from "../api/client";
import ThemeToggle from "../components/ThemeToggle";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { token, new_password: password });
      setDone(true);
    } catch (err) {
      setError(err?.response?.data?.detail || "El enlace no es válido o ya expiró.");
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg px-4">
        <div className="text-center">
          <p className="text-sm text-ink-soft mb-4">Enlace de recuperación inválido.</p>
          <Link to="/recuperar" className="text-sm font-medium text-signal">
            Solicitar uno nuevo
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-signal text-panel">
            <CheckCircle2 size={22} strokeWidth={2.5} />
          </span>
          <h1 className="font-mono text-xl font-semibold tracking-tight">rutina</h1>
          <p className="text-sm text-ink-soft">Nueva contraseña</p>
        </div>

        <div className="rounded-2xl border border-line bg-panel p-6 shadow-[var(--shadow-card)]">
          {done ? (
            <div className="flex flex-col items-center gap-3 text-center py-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-signal/10">
                <CheckCircle2 size={20} className="text-signal" />
              </div>
              <p className="text-sm font-medium text-ink">¡Contraseña actualizada!</p>
              <p className="text-xs text-ink-soft">Ya puedes iniciar sesión con tu nueva contraseña.</p>
              <button
                onClick={() => navigate("/login")}
                className="mt-2 w-full rounded-lg bg-ink py-2.5 text-sm font-semibold text-bg transition-opacity hover:opacity-90 cursor-pointer"
              >
                Ir al inicio de sesión
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-soft">
                  Nueva contraseña
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm outline-none focus:border-signal"
                  placeholder="Mínimo 8 caracteres"
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-ink-soft">
                  Confirmar contraseña
                </label>
                <input
                  type="password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm outline-none focus:border-signal"
                  placeholder="Repite la contraseña"
                />
              </div>

              {error && (
                <p className="rounded-lg bg-coral-soft px-3 py-2 text-sm text-coral">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-1 rounded-lg bg-ink py-2.5 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-60 cursor-pointer"
              >
                {loading ? "Guardando…" : "Guardar nueva contraseña"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
