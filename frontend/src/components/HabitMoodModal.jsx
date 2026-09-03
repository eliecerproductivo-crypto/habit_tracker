import { useState, useEffect } from "react";
import { Check, X, Sparkles } from "lucide-react";

export const MOOD_OPTIONS = [
  { key: "great", emoji: "🤩", label: "Genial" },
  { key: "good", emoji: "😊", label: "Bien" },
  { key: "neutral", emoji: "😐", label: "Normal" },
  { key: "tired", emoji: "🥱", label: "Cansado" },
  { key: "hard", emoji: "😫", label: "Difícil" },
];

export function getMoodInfo(moodKey) {
  return MOOD_OPTIONS.find((m) => m.key === moodKey) || null;
}

export default function HabitMoodModal({
  isOpen,
  habit,
  initialMood = null,
  initialNote = "",
  status = "done",
  onSave,
  onClose,
}) {
  const [selectedMood, setSelectedMood] = useState(initialMood);
  const [note, setNote] = useState(initialNote);

  useEffect(() => {
    if (isOpen) {
      setSelectedMood(initialMood || null);
      setNote(initialNote || "");
    }
  }, [isOpen, initialMood, initialNote]);

  if (!isOpen || !habit) return null;

  const statusLabel =
    status === "done" ? "¡Hábito hecho!" : status === "skipped" ? "Hábito omitido" : "Hábito no realizado";

  const handleSave = () => {
    onSave({
      mood: selectedMood,
      note: note.trim(),
    });
  };

  const handleSkip = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-panel p-5 shadow-xl animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <span className="inline-block rounded-full bg-signal-soft px-2.5 py-0.5 text-[11px] font-semibold text-signal">
              {statusLabel}
            </span>
            <h3 className="mt-1.5 font-semibold text-ink text-base truncate max-w-[240px]">
              {habit.name}
            </h3>
            <p className="text-xs text-ink-soft mt-0.5">
              ¿Cómo te sentiste al realizarlo?
            </p>
          </div>
          <button
            onClick={handleSkip}
            className="rounded-lg p-1 text-ink-faint hover:bg-panel-alt hover:text-ink transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Emojis Selector */}
        <div className="mt-4 flex justify-between gap-1.5">
          {MOOD_OPTIONS.map((m) => {
            const isSelected = selectedMood === m.key;
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => setSelectedMood(isSelected ? null : m.key)}
                className={[
                  "flex flex-1 flex-col items-center gap-1 rounded-xl p-2 transition-all cursor-pointer border",
                  isSelected
                    ? "border-signal bg-signal-soft scale-105 shadow-xs"
                    : "border-line bg-panel-alt/50 hover:bg-panel-alt hover:border-line",
                ].join(" ")}
              >
                <span className="text-2xl">{m.emoji}</span>
                <span className="text-[10px] font-medium text-ink-soft truncate">
                  {m.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Micro-nota */}
        <div className="mt-4">
          <label className="block text-xs font-medium text-ink-soft mb-1">
            Nota rápida (opcional):
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Ej. Me costó arrancar pero me dio energía..."
            rows={2}
            maxLength={300}
            className="w-full rounded-xl border border-line bg-bg p-2.5 text-xs text-ink placeholder:text-ink-faint focus:border-signal focus:outline-none"
          />
        </div>

        {/* Acciones */}
        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleSkip}
            className="rounded-xl px-3.5 py-2 text-xs font-medium text-ink-soft hover:text-ink transition-colors cursor-pointer"
          >
            Saltar
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-1 rounded-xl bg-ink px-4 py-2 text-xs font-semibold text-bg hover:opacity-90 transition-all cursor-pointer"
          >
            <Check size={14} />
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
