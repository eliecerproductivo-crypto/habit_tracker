import { useState } from "react";
import { Shuffle, AlertTriangle, CheckCircle, Info, BedDouble } from "lucide-react";
import { todayLocalISODate } from "../lib/schedule";

export default function WildcardWidget({ wildcard, currentStreak = 0, onUse, gained = false, habitWildcard = null }) {
  const [using, setUsing]           = useState(false);
  const [useError, setUseError]     = useState("");
  const [useSuccess, setUseSuccess] = useState(false);

  if (!wildcard) return null;

  const { balance, max_balance, next_milestone, can_use_today, at_cap } = wildcard;
  const today = todayLocalISODate();

  // Progreso hacia el siguiente comodín
  const prevMilestone = wildcard.last_milestone;
  const daysIntoRange = Math.min(Math.max(currentStreak - prevMilestone, 0), 15);
  const progressPct   = Math.round((daysIntoRange / 15) * 100);

  const canUse = balance > 0 && can_use_today;

  const handleUse = async () => {
    setUseError("");
    setUsing(true);
    try {
      await onUse(today);
      setUseSuccess(true);
      setTimeout(() => setUseSuccess(false), 3000);
    } catch (err) {
      setUseError(err?.response?.data?.detail || "No se pudo usar el comodín.");
    } finally {
      setUsing(false);
    }
  };

  return (
    <div className="rounded-2xl border border-line bg-panel px-4 py-3 flex flex-col gap-2.5">

      {/* ── Fila principal — comodín de día libre ── */}
      <div className="flex items-center gap-3">

        {/* Cartas de saldo */}
        <div className="flex gap-1 shrink-0">
          {Array.from({ length: max_balance }).map((_, i) => (
            <span
              key={i}
              title={i < balance ? "Comodín disponible" : "Vacío"}
              className={[
                "text-base leading-none transition-all",
                i < balance ? "opacity-100" : "opacity-25 grayscale",
              ].join(" ")}
            >
              🃏
            </span>
          ))}
        </div>

        {/* Texto y progreso */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-xs font-semibold text-ink leading-none">
              {balance === 0
                ? "Sin comodines"
                : balance === 1
                ? "1 comodín guardado"
                : "2 comodines — reserva llena"}
            </p>
            {!at_cap && (
              <span className="text-[10px] text-ink-faint font-mono tabular shrink-0">
                {daysIntoRange}/15 días
              </span>
            )}
          </div>

          {/* Barra de progreso — solo si no está al tope */}
          {!at_cap ? (
            <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-bg border border-line">
              <div
                className="h-full rounded-full bg-signal transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          ) : (
            <p className="mt-0.5 text-[10px] text-signal font-medium">
              Usa uno antes de ganar el siguiente (día {next_milestone})
            </p>
          )}
        </div>

        {/* Botón compacto */}
        {useSuccess ? (
          <span className="flex items-center gap-1 text-xs font-medium text-mint shrink-0">
            <CheckCircle size={13} /> Activado
          </span>
        ) : (
          <button
            type="button"
            onClick={handleUse}
            disabled={using || !canUse}
            title={
              balance === 0
                ? "Completa 15 días seguidos para ganar un comodín"
                : !can_use_today
                ? "Usaste un comodín ayer — completa tus hábitos hoy"
                : "Proteger la racha de hoy"
            }
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-signal px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer"
          >
            <Shuffle size={12} />
            {using ? "…" : "Usar"}
          </button>
        )}
      </div>

      {/* Alerta anti-consecutivo */}
      {balance > 0 && !can_use_today && (
        <p className="flex items-center gap-1 text-[11px] text-coral">
          <AlertTriangle size={11} />
          Usaste un comodín ayer — completa tus hábitos hoy para mantener la racha.
        </p>
      )}

      {/* Toast ganado */}
      {gained && (
        <p className="text-[11px] font-semibold text-signal">
          🃏 ¡Ganaste un comodín por llegar a {wildcard.last_milestone} días de racha!
        </p>
      )}

      {useError && (
        <p className="text-[11px] text-coral">{useError}</p>
      )}

      {/* ── Sección de descansos por quincena ── */}
      {habitWildcard && (
        <div className="border-t border-line pt-2.5 flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <BedDouble size={13} className="text-violet shrink-0" />
              <p className="text-xs font-semibold text-ink">
                Descansos esta quincena
              </p>
            </div>
            <span className={[
              "text-xs font-mono font-bold tabular shrink-0",
              habitWildcard.quota_remaining > 0 ? "text-violet" : "text-ink-faint",
            ].join(" ")}>
              {habitWildcard.quota_remaining}/{habitWildcard.quota_total}
            </span>
          </div>

          {/* Barra de usos */}
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg border border-line">
            <div
              className="h-full rounded-full bg-violet/70 transition-all duration-500"
              style={{ width: `${Math.round(((habitWildcard.quota_total - habitWildcard.quota_remaining) / Math.max(habitWildcard.quota_total, 1)) * 100)}%` }}
            />
          </div>

          {/* Estado del segundo descanso */}
          {!habitWildcard.second_earned && habitWildcard.quota_total < 2 && (
            <p className="text-[10px] text-ink-faint leading-relaxed">
              🎯 Cumple todos los hábitos en la primera mitad de la quincena para ganar un 2.° descanso.
            </p>
          )}
          {habitWildcard.second_earned && habitWildcard.quota_total === 2 && (
            <p className="text-[10px] text-violet font-semibold">
              ✓ Ganaste el 2.° descanso por tu racha en la primera mitad.
            </p>
          )}
        </div>
      )}

      {/* Ayuda desplegable mínima */}
      <details className="group">
        <summary className="cursor-pointer select-none flex items-center gap-1 text-[10px] text-ink-faint hover:text-ink transition-colors list-none">
          <Info size={10} />
          Cómo funcionan los comodines
        </summary>
        <ul className="mt-1.5 flex flex-col gap-1 text-[11px] text-ink-soft leading-relaxed pl-1">
          <li>🃏 Ganas 1 cada <strong>15 días de racha</strong> (tope: 2).</li>
          <li>🛡️ Úsalo si no puedes completar tus hábitos — la racha se mantiene.</li>
          <li>🚫 No puedes usar dos días <strong>consecutivos</strong>.</li>
          <li>🛌 "Descansar" — usa 1 descanso de la quincena para un hábito. La racha se mantiene.</li>
          <li>🎯 Cumple la primera mitad de la quincena sin fallar para ganar un 2.° descanso.</li>
        </ul>
      </details>
    </div>
  );
}
