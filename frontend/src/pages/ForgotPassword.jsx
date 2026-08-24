import { useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import api from "../api/client";
import ThemeToggle from "../components/ThemeToggle";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setSent(true);
    } catch {
      setError("Ocurrió un error. Intenta de nuevo.");
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
          <p className="text-sm text-ink-soft">Recupera tu contraseña</p>
        </div>

        <div className="rounded-2xl border border-line bg-panel p-6 shadow-[var(--shadow-card)]">
          {sent ? (
            <div className="flex flex-col items-center gap-3 text-center py-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-signal/10">
                <CheckCircle2 size={20} className="text-signal" />
              </div>
              <p className="text-sm font-medium text-ink">Revisa tu correo</p>
              <p className="text-xs text-ink-soft">
                Si <strong>{email}</strong> tiene una cuenta, recibirás un enlace para restablecer tu contraseña. El enlace expira en 1 hora.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <p className="text-sm text-ink-soft">
                Ingresa tu correo y te enviaremos un enlace para crear una nueva contraseña.
              </p>
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
                  autoFocus
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
                {loading ? "Enviando…" : "Enviar enlace"}
              </button>
            </form>
          )}
        </div>

        <p className="mt-5 text-center text-sm text-ink-soft">
          <Link to="/login" className="font-medium text-signal">
            Volver al inicio de sesión
          </Link>
        </p>
      </div>
    </div>
  );
}
