import { useState } from "react";
import { CATEGORY_OPTIONS } from "../lib/categories";
import { DAY_LABELS } from "../lib/schedule";

const EMPTY = {
  name: "",
  description: "",
  category: "trabajo",
  days_of_week: [1, 2, 3, 4, 5],
  start_time: "08:00",
  end_time: "09:00",
  start_date: "",
  recurrence_type: "weekly",
  recurrence_interval: 2,
  recurrence_day_of_month: 1,
};

const RECURRENCE_LABELS = {
  weekly:   "Días de la semana",
  interval: "Cada N días",
  monthly:  "Día del mes",
};

export default function HabitForm({ initial, onSubmit, onCancel, submitLabel = "Guardar hábito" }) {
  const [form, setForm] = useState(() => {
    if (!initial) return EMPTY;
    return {
      ...EMPTY,
      ...initial,
      days_of_week: Array.isArray(initial.days_of_week)
        ? initial.days_of_week
        : (initial.days_of_week || "").split(",").filter(Boolean).map(Number),
      start_date: initial.start_date ? String(initial.start_date).slice(0, 10) : "",
      recurrence_type: initial.recurrence_type || "weekly",
      recurrence_interval: initial.recurrence_interval || 2,
      recurrence_day_of_month: initial.recurrence_day_of_month || 1,
    };
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (key, val) => setForm((f) => ({ ...f, [key]: val }));

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
    if (!form.name.trim()) { setError("Ponle un nombre al hábito."); return; }
    if (form.recurrence_type === "weekly" && form.days_of_week.length === 0) {
      setError("Selecciona al menos un día."); return;
    }
    if (form.recurrence_type === "interval" && (!form.recurrence_interval || form.recurrence_interval < 1)) {
      setError("El intervalo debe ser al menos 1 día."); return;
    }
    if (form.recurrence_type === "monthly" && !form.recurrence_day_of_month) {
      setError("Selecciona el día del mes."); return;
    }
    setSaving(true);
    try {
      await onSubmit({
        ...form,
        days_of_week: form.recurrence_type === "weekly" ? form.days_of_week.join(",") : "0",
        recurrence_interval: form.recurrence_type === "interval" ? Number(form.recurrence_interval) : null,
        recurrence_day_of_month: form.recurrence_type === "monthly" ? Number(form.recurrence_day_of_month) : null,
        start_date: form.start_date || null,
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

      {/* Nombre */}
      <div>
        <label className="mb-1 block text-xs font-medium text-ink-soft">Nombre</label>
        <input
          className={inputClass}
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Ej. Deep work: proyecto"
          autoFocus
        />
      </div>

      {/* Descripción */}
      <div>
        <label className="mb-1 block text-xs font-medium text-ink-soft">
          Descripción <span className="text-ink-faint">(opcional)</span>
        </label>
        <input
          className={inputClass}
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Detalle corto"
        />
      </div>

      {/* Categoría */}
      <div>
        <label className="mb-1 block text-xs font-medium text-ink-soft">Categoría</label>
        <select
          className={inputClass}
          value={form.category}
          onChange={(e) => set("category", e.target.value)}
        >
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      {/* Horas */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft">Hora inicio</label>
          <input type="time" className={inputClass} value={form.start_time}
            onChange={(e) => set("start_time", e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft">Hora fin</label>
          <input type="time" className={inputClass} value={form.end_time}
            onChange={(e) => set("end_time", e.target.value)} />
        </div>
      </div>

      {/* Tipo de recurrencia */}
      <div>
        <label className="mb-1.5 block text-xs font-medium text-ink-soft">Frecuencia</label>
        <div className="flex rounded-lg border border-line overflow-hidden">
          {Object.entries(RECURRENCE_LABELS).map(([type, label]) => (
            <button
              key={type}
              type="button"
              onClick={() => set("recurrence_type", type)}
              className={[
                "flex-1 py-2 text-xs font-semibold transition-colors cursor-pointer",
                form.recurrence_type === type
                  ? "bg-signal text-panel"
                  : "bg-panel-alt text-ink-faint hover:text-ink",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Opciones según tipo */}
      {form.recurrence_type === "weekly" && (
        <div>
          <label className="mb-1.5 block text-xs font-medium text-ink-soft">Días de la semana</label>
          <div className="flex gap-1.5">
            {DAY_LABELS.map((label, i) => {
              const active = form.days_of_week.includes(i);
              return (
                <button type="button" key={i} onClick={() => toggleDay(i)}
                  className={[
                    "h-9 flex-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer",
                    active ? "bg-signal text-panel" : "bg-panel-alt text-ink-faint hover:text-ink-soft",
                  ].join(" ")}>
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {form.recurrence_type === "interval" && (
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft">
            Repetir cada cuántos días
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={1}
              max={365}
              className="w-24 rounded-lg border border-line bg-bg px-3 py-2 text-center text-sm text-ink outline-none focus:border-signal"
              value={form.recurrence_interval}
              onChange={(e) => set("recurrence_interval", e.target.value)}
            />
            <span className="text-sm text-ink-soft">días</span>
          </div>
          <p className="mt-1 text-xs text-ink-faint">
            Se repite cada N días desde la fecha de inicio.
          </p>
        </div>
      )}

      {form.recurrence_type === "monthly" && (
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft">Día del mes</label>
          <div className="flex flex-wrap gap-1.5">
            {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => set("recurrence_day_of_month", d)}
                className={[
                  "h-8 w-8 rounded-lg text-xs font-semibold transition-colors cursor-pointer",
                  form.recurrence_day_of_month === d
                    ? "bg-signal text-panel"
                    : "bg-panel-alt text-ink-faint hover:text-ink",
                ].join(" ")}
              >
                {d}
              </button>
            ))}
            <button
              type="button"
              onClick={() => set("recurrence_day_of_month", -1)}
              className={[
                "rounded-lg px-3 text-xs font-semibold transition-colors cursor-pointer",
                form.recurrence_day_of_month === -1
                  ? "bg-signal text-panel"
                  : "bg-panel-alt text-ink-faint hover:text-ink",
              ].join(" ")}
            >
              Último
            </button>
          </div>
        </div>
      )}

      {/* Fecha de inicio */}
      <div>
        <label className="mb-1 block text-xs font-medium text-ink-soft">
          Fecha de inicio <span className="text-ink-faint">(opcional)</span>
        </label>
        <input
          type="date"
          className={inputClass}
          value={form.start_date}
          onChange={(e) => set("start_date", e.target.value)}
        />
        {form.start_date && (
          <button type="button" onClick={() => set("start_date", "")}
            className="mt-1 text-xs text-ink-faint hover:text-coral cursor-pointer">
            Quitar fecha de inicio
          </button>
        )}
        <p className="mt-1 text-xs text-ink-faint">
          {form.recurrence_type === "interval"
            ? "Marca el primer día del ciclo."
            : "Si no pones fecha, el hábito empieza hoy."}
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-coral-soft px-3 py-2 text-sm text-coral">{error}</p>
      )}

      <div className="mt-1 flex gap-2">
        <button type="button" onClick={onCancel}
          className="flex-1 rounded-lg border border-line py-2.5 text-sm font-medium text-ink-soft transition-colors hover:bg-panel-alt cursor-pointer">
          Cancelar
        </button>
        <button type="submit" disabled={saving}
          className="flex-1 rounded-lg bg-ink py-2.5 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-60 cursor-pointer">
          {saving ? "Guardando…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
