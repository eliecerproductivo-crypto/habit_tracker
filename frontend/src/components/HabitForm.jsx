import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus, Check } from "lucide-react";
import { DAY_LABELS } from "../lib/schedule";
import { useCategories } from "../hooks/useCategories";

const EMPTY = {
  name: "",
  description: "",
  category: "",
  days_of_week: [1, 2, 3, 4, 5],
  has_time: false,
  start_time: "08:00",
  end_time: "09:00",
  duration_minutes: "",
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

// ── Category dropdown ─────────────────────────────────────────────────────────
function CategorySelect({ value, onChange }) {
  const { displayCategories, addCategory, deleteCategory } = useCategories();
  const [open, setOpen] = useState(false);
  const [newCat, setNewCat] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null); // category id
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setConfirmDelete(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSelect = (cat) => { onChange(cat.name); setOpen(false); setConfirmDelete(null); };

  const handleAdd = async () => {
    const trimmed = newCat.trim();
    if (!trimmed) return;
    const cat = await addCategory(trimmed);
    onChange(cat.name);
    setNewCat("");
    setOpen(false);
  };

  const handleDelete = async (cat) => {
    if (cat.id < 0) return;
    try {
      await deleteCategory(cat.id);
      if (value === cat.name) onChange("");
    } catch (err) {
      console.error("Error eliminando categoría:", err?.response?.status, err?.response?.data);
    } finally {
      setConfirmDelete(null);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { setOpen((o) => !o); setConfirmDelete(null); }}
        className="flex w-full items-center justify-between rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-signal cursor-pointer"
      >
        <span className={value ? "text-ink" : "text-ink-faint"}>
          {value || "Selecciona o crea una categoría"}
        </span>
        <ChevronDown size={15} className={`text-ink-faint transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-1 rounded-xl border border-line bg-panel shadow-[var(--shadow-card)]">
          <ul className="max-h-48 overflow-y-auto py-1">
            {displayCategories.map((cat) => (
              <li key={cat.id}>
                {confirmDelete === cat.id ? (
                  <div className="px-3 py-2 bg-coral-soft">
                    <p className="mb-1.5 text-xs text-coral font-medium">
                      ¿Eliminar "{cat.name}"? Los hábitos que la tienen la seguirán teniendo hasta que los edites.
                    </p>
                    <div className="flex gap-2">
                      <button type="button"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          handleDelete(cat);
                        }}
                        className="flex-1 rounded-lg bg-coral py-1 text-xs font-semibold text-white cursor-pointer">
                        Sí, eliminar
                      </button>
                      <button type="button"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          setConfirmDelete(null);
                        }}
                        className="flex-1 rounded-lg border border-line py-1 text-xs font-medium text-ink-soft cursor-pointer">
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center">
                    <button type="button" onClick={() => handleSelect(cat)}
                      className="flex flex-1 items-center justify-between px-3 py-2 text-sm text-ink hover:bg-panel-alt cursor-pointer">
                      {cat.name}
                      {value === cat.name && <Check size={13} className="text-signal" />}
                    </button>
                    <button type="button"
                      onClick={(e) => { e.stopPropagation(); setConfirmDelete(cat.id); }}
                      className="mr-2 flex h-5 w-5 items-center justify-center rounded text-ink-faint hover:bg-coral-soft hover:text-coral cursor-pointer text-xs"
                      title="Eliminar categoría">
                      ×
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <div className="border-t border-line p-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAdd(); } }}
                placeholder="Nueva categoría…"
                className="flex-1 rounded-lg border border-line bg-bg px-2 py-1.5 text-xs outline-none focus:border-signal"
              />
              <button type="button" onClick={handleAdd} disabled={!newCat.trim()}
                className="flex items-center gap-1 rounded-lg bg-signal px-2 py-1.5 text-xs font-semibold text-panel disabled:opacity-40 cursor-pointer">
                <Plus size={12} />
                Agregar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────
export default function HabitForm({ initial, onSubmit, onCancel, submitLabel = "Guardar hábito" }) {
  const [form, setForm] = useState(() => {
    if (!initial) return EMPTY;
    return {
      ...EMPTY,
      ...initial,
      has_time: !!(initial.start_time),
      duration_minutes: initial.duration_minutes ? String(initial.duration_minutes) : "",
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
    if (!form.category.trim()) { setError("Selecciona o crea una categoría."); return; }
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
        start_time: form.has_time ? form.start_time : null,
        end_time: form.has_time ? form.end_time : null,
        duration_minutes: !form.has_time && form.duration_minutes ? Number(form.duration_minutes) : null,
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

  const inputClass = "w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-signal";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">

      <div>
        <label className="mb-1 block text-xs font-medium text-ink-soft">Nombre</label>
        <input className={inputClass} value={form.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Ej. Deep work: proyecto" autoFocus />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-ink-soft">
          Descripción <span className="text-ink-faint">(opcional)</span>
        </label>
        <input className={inputClass} value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Detalle corto" />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-ink-soft">Categoría</label>
        <CategorySelect value={form.category} onChange={(v) => set("category", v)} />
      </div>

      <div>
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-ink-soft">Hora fija</label>
          <button
            type="button"
            onClick={() => set("has_time", !form.has_time)}
            className={[
              "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
              form.has_time ? "bg-signal" : "bg-panel-alt",
            ].join(" ")}
            role="switch"
            aria-checked={form.has_time}
          >
            <span
              className={[
                "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform",
                form.has_time ? "translate-x-4" : "translate-x-0",
              ].join(" ")}
            />
          </button>
        </div>
        {form.has_time && (
          <div className="mt-3 grid grid-cols-2 gap-3">
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
        )}
        {!form.has_time && (
          <div className="mt-3 flex items-center gap-3">
            <input
              type="number"
              min={1}
              max={480}
              value={form.duration_minutes}
              onChange={(e) => set("duration_minutes", e.target.value)}
              placeholder="30"
              className="w-20 rounded-lg border border-line bg-bg px-3 py-2 text-center text-sm text-ink outline-none focus:border-signal"
            />
            <span className="text-sm text-ink-soft">minutos objetivo <span className="text-ink-faint">(opcional)</span></span>
          </div>
        )}
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-ink-soft">Frecuencia</label>
        <div className="flex rounded-lg border border-line overflow-hidden">
          {Object.entries(RECURRENCE_LABELS).map(([type, label]) => (
            <button key={type} type="button" onClick={() => set("recurrence_type", type)}
              className={["flex-1 py-2 text-xs font-semibold transition-colors cursor-pointer",
                form.recurrence_type === type ? "bg-signal text-panel" : "bg-panel-alt text-ink-faint hover:text-ink",
              ].join(" ")}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {form.recurrence_type === "weekly" && (
        <div>
          <label className="mb-1.5 block text-xs font-medium text-ink-soft">Días de la semana</label>
          <div className="flex gap-1.5">
            {DAY_LABELS.map((label, i) => (
              <button type="button" key={i} onClick={() => toggleDay(i)}
                className={["h-9 flex-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer",
                  form.days_of_week.includes(i) ? "bg-signal text-panel" : "bg-panel-alt text-ink-faint hover:text-ink-soft",
                ].join(" ")}>
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {form.recurrence_type === "interval" && (
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-soft">Repetir cada cuántos días</label>
          <div className="flex items-center gap-3">
            <input type="number" min={1} max={365}
              className="w-24 rounded-lg border border-line bg-bg px-3 py-2 text-center text-sm text-ink outline-none focus:border-signal"
              value={form.recurrence_interval} onChange={(e) => set("recurrence_interval", e.target.value)} />
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
              <button key={d} type="button" onClick={() => set("recurrence_day_of_month", d)}
                className={["h-8 w-8 rounded-lg text-xs font-semibold transition-colors cursor-pointer",
                  form.recurrence_day_of_month === d ? "bg-signal text-panel" : "bg-panel-alt text-ink-faint hover:text-ink",
                ].join(" ")}>
                {d}
              </button>
            ))}
            <button type="button" onClick={() => set("recurrence_day_of_month", -1)}
              className={["rounded-lg px-3 text-xs font-semibold transition-colors cursor-pointer",
                form.recurrence_day_of_month === -1 ? "bg-signal text-panel" : "bg-panel-alt text-ink-faint hover:text-ink",
              ].join(" ")}>
              Último
            </button>
          </div>
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs font-medium text-ink-soft">
          Fecha de inicio <span className="text-ink-faint">(opcional)</span>
        </label>
        <input type="date" className={inputClass} value={form.start_date}
          onChange={(e) => set("start_date", e.target.value)} />
        {form.start_date && (
          <button type="button" onClick={() => set("start_date", "")}
            className="mt-1 text-xs text-ink-faint hover:text-coral cursor-pointer">
            Quitar fecha de inicio
          </button>
        )}
        <p className="mt-1 text-xs text-ink-faint">
          {form.recurrence_type === "interval" ? "Marca el primer día del ciclo." : "Si no pones fecha, el hábito empieza hoy."}
        </p>
      </div>

      {error && <p className="rounded-lg bg-coral-soft px-3 py-2 text-sm text-coral">{error}</p>}

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
