import { useState } from "react";
import { CATEGORY_OPTIONS } from "../lib/categories";
import { DAY_LABELS } from "../lib/schedule";

const EMPTY = {
  name: "",
  description: "",
  category: "trabajo",
  days_of_week: [1, 2, 3, 4, 5], // lun-vie by default
  start_time: "08:00",
  end_time: "09:00",
};

export default function HabitForm({ initial, onSubmit, onCancel, submitLabel = "Guardar hábito" }) {
  const [form, setForm] = useState(() =>
    initial
      ? {
          ...EMPTY,
          ...initial,
          days_of_week: Array.isArray(initial.days_of_week)
            ? initial.days_of_week
            : (initial.days_of_week || "")
                .split(",")
                .filter(Boolean)
                .map(Number),
        }
      : EMPTY
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const toggleDay = (d) => {
    setForm((f) => ({
      ...f,
      days_of_week: f.days_of_week.includes(d)
        ? f.days_of_week.filter((x) => x !== d)
        : [...f.days_of_week, d].sort(),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) {
      setError("Ponle un nombre al hábito.");
      return;
    }
    if (form.days_of_week.length === 0) {
      setError("Selecciona al menos un día.");
      return;
    }
    setSaving(true);
    try {
      await onSubmit({
        ...form,
        days_of_week: form.days_of_week.join(","),
      });
    } catch (err) {
      setError(err?.response?.data?.detail || "No se pudo guardar el hábito.");
    } finally {
      setSaving(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-signal";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-ink-soft">
          Nombre
        </label>
        <input
          className={inputClass}
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="Ej. Deep work: proyecto"
          autoFocus
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-ink-soft">
          Descripción (opcional)
        </label>
        <input
          className={inputClass}
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          placeholder="Detalle corto"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-ink-soft">
          Categoría
        </label>
        <select
          className={inputClass}
          value={form.category}
          onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
        >
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft">
            Hora inicio
          </label>
          <input
            type="time"
            className={inputClass}
            value={form.start_time}
            onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft">
            Hora fin
          </label>
          <input
            type="time"
            className={inputClass}
            value={form.end_time}
            onChange={(e) => setForm((f) => ({ ...f, end_time: e.target.value }))}
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-ink-soft">
          Días de la semana
        </label>
        <div className="flex gap-1.5">
          {DAY_LABELS.map((label, i) => {
            const active = form.days_of_week.includes(i);
            return (
              <button
                type="button"
                key={i}
                onClick={() => toggleDay(i)}
                className={[
                  "h-9 flex-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer",
                  active
                    ? "bg-signal text-panel"
                    : "bg-panel-alt text-ink-faint hover:text-ink-soft",
                ].join(" ")}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {error && (
        <p className="rounded-lg bg-coral-soft px-3 py-2 text-sm text-coral">
          {error}
        </p>
      )}

      <div className="mt-1 flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-lg border border-line py-2.5 text-sm font-medium text-ink-soft transition-colors hover:bg-panel-alt cursor-pointer"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-lg bg-ink py-2.5 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-60 cursor-pointer"
        >
          {saving ? "Guardando…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
