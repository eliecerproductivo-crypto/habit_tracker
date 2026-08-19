import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import ThemeToggle from "../components/ThemeToggle";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(
        err?.response?.data?.detail || "Correo o contraseña incorrectos."
      );
    } finally {
      setLoading(false);
    }
  };

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
          <p className="text-sm text-ink-soft">
            Inicia sesión para ver tu plan de hoy
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-2xl border border-line bg-panel p-6 shadow-[var(--shadow-card)]"
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft">
              Correo electrónico
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm outline-none focus:border-signal"
              placeholder="tu@correo.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft">
              Contraseña
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-line bg-bg px-3 py-2.5 text-sm outline-none focus:border-signal"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-coral-soft px-3 py-2 text-sm text-coral">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-1 rounded-lg bg-ink py-2.5 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-60 cursor-pointer"
          >
            {loading ? "Entrando…" : "Iniciar sesión"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-ink-soft">
          ¿No tienes cuenta?{" "}
          <Link to="/registro" className="font-medium text-signal">
            Crea una
          </Link>
        </p>
      </div>
    </div>
  );
}
