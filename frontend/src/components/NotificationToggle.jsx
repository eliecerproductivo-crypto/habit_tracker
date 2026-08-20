import { useState } from "react";
import { Bell, BellOff } from "lucide-react";
import Modal from "./Modal";

export default function NotificationToggle({
  permission,
  advanceMinutes,
  onRequest,
  onChangeMinutes,
}) {
  const [showModal, setShowModal] = useState(false);
  const [inputVal, setInputVal] = useState(String(advanceMinutes));

  const isGranted = permission === "granted";
  const isDenied = permission === "denied";
  const isUnsupported = permission === "unsupported";

  const handleToggle = () => {
    if (isUnsupported || isDenied) return;
    if (!isGranted) {
      onRequest();
      return;
    }
    setInputVal(String(advanceMinutes));
    setShowModal(true);
  };

  const handleSave = () => {
    const val = parseInt(inputVal, 10);
    if (Number.isFinite(val) && val > 0) {
      onChangeMinutes(val);
    }
    setShowModal(false);
  };

  const title =
    isUnsupported
      ? "Tu navegador no soporta notificaciones"
      : isDenied
      ? "Notificaciones bloqueadas — habilítalas en ajustes del navegador"
      : isGranted
      ? `Notificaciones activas · ${advanceMinutes} min antes`
      : "Activar notificaciones";

  return (
    <>
      <button
        onClick={handleToggle}
        disabled={isUnsupported || isDenied}
        title={title}
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

      <Modal
        open={showModal}
        onClose={() => setShowModal(false)}
        title="Notificaciones"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-ink-soft">
            Recibirás un aviso antes de que comience cada hábito del día.
          </p>

          <div>
            <label className="mb-1 block text-xs font-medium text-ink-soft">
              Avisar con cuántos minutos de anticipación
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={1}
                max={120}
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                className="w-20 rounded-lg border border-line bg-bg px-3 py-2 text-center text-sm outline-none focus:border-signal"
              />
              <span className="text-sm text-ink-soft">minutos antes</span>
            </div>
            <p className="mt-1 text-xs text-ink-faint">Entre 1 y 120 minutos</p>
          </div>

          {/* Quick presets */}
          <div className="flex gap-2">
            {[5, 10, 15, 30].map((m) => (
              <button
                key={m}
                onClick={() => setInputVal(String(m))}
                className={[
                  "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer",
                  String(m) === inputVal
                    ? "border-signal bg-signal-soft text-signal"
                    : "border-line text-ink-soft hover:border-signal hover:text-signal",
                ].join(" ")}
              >
                {m} min
              </button>
            ))}
          </div>

          <button
            onClick={handleSave}
            className="w-full rounded-lg bg-ink py-2.5 text-sm font-semibold text-bg transition-opacity hover:opacity-90 cursor-pointer"
          >
            Guardar
          </button>
        </div>
      </Modal>
    </>
  );
}
