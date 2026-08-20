import { useState } from "react";
import { Bell, BellOff } from "lucide-react";

export default function NotificationToggle({ permission, advanceMinutes, onRequest, onChangeMinutes }) {
  const [showConfig, setShowConfig] = useState(false);
  const [inputVal, setInputVal] = useState(String(advanceMinutes));

  const isGranted = permission === "granted";
  const isDenied = permission === "denied";
  const isUnsupported = permission === "unsupported";

  const handleToggle = () => {
    if (isUnsupported) return;
    if (!isGranted) {
      onRequest();
      return;
    }
    setShowConfig((v) => !v);
  };

  const handleSave = () => {
    const val = parseInt(inputVal, 10);
    if (Number.isFinite(val) && val > 0) {
      onChangeMinutes(val);
    }
    setShowConfig(false);
  };

  return (
    <div className="relative">
      <button
        onClick={handleToggle}
        disabled={isUnsupported || isDenied}
        title={
          isUnsupported
            ? "Tu navegador no soporta notificaciones"
            : isDenied
            ? "Notificaciones bloqueadas — habilítalas en la configuración del navegador"
            : isGranted
            ? `Notificaciones activas · ${advanceMinutes} min antes`
            : "Activar notificaciones"
        }
        aria-label="Notificaciones"
        className={[
          "flex h-8 w-8 items-center justify-center rounded-lg transition-colors cursor-pointer",
          isGranted
            ? "text-signal hover:bg-signal-soft"
            : "text-ink-faint hover:bg-panel-alt",
          (isUnsupported || isDenied) && "opacity-40 cursor-not-allowed",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {isGranted ? <Bell size={17} /> : <BellOff size={17} />}
      </button>

      {showConfig && isGranted && (
        <div className="absolute right-0 top-10 z-50 w-56 rounded-xl border border-line bg-panel p-4 shadow-[var(--shadow-card)]">
          <p className="mb-2 text-xs font-semibold text-ink">Avisar con</p>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={120}
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              className="w-16 rounded-lg border border-line bg-bg px-2 py-1.5 text-center text-sm outline-none focus:border-signal"
            />
            <span className="text-sm text-ink-soft">minutos antes</span>
          </div>
          <button
            onClick={handleSave}
            className="mt-3 w-full rounded-lg bg-signal py-1.5 text-xs font-semibold text-panel transition-opacity hover:opacity-90 cursor-pointer"
          >
            Guardar
          </button>
        </div>
      )}
    </div>
  );
}
