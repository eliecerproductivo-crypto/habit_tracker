import { useState, useRef, useEffect } from "react";
import {
  Plus, Check, Trash2, Calendar, Flag, ChevronDown, ChevronUp, X, Pencil,
} from "lucide-react";
import { useTodos } from "../hooks/useTodos";

// ── Helpers ────────────────────────────────────────────────────────────────────

const PRIORITY_CONFIG = {
  3: { label: "Alta",   color: "text-coral",  bg: "bg-coral-soft",  border: "border-coral/40"  },
  2: { label: "Media",  color: "text-signal", bg: "bg-signal-soft", border: "border-signal/40" },
  1: { label: "Baja",   color: "text-mint",   bg: "bg-mint-soft",   border: "border-mint/40"   },
};

function formatDue(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d - today) / 86400000);
  if (diff < 0)  return { label: `Venció hace ${Math.abs(diff)}d`, overdue: true };
  if (diff === 0) return { label: "Hoy",    overdue: false };
  if (diff === 1) return { label: "Mañana", overdue: false };
  return {
    label: d.toLocaleDateString("es", { day: "numeric", month: "short" }),
    overdue: false,
  };
}

// ── Inline edit row ────────────────────────────────────────────────────────────

function EditRow({ item, onSave, onCancel }) {
  const [text, setText]         = useState(item.text);
  const [due, setDue]           = useState(item.due_date || "");
  const [priority, setPriority] = useState(item.priority || "");
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const handleSave = () => {
    if (!text.trim()) return;
    onSave({
      text: text.trim(),
      due_date: due || null,
      priority: priority ? Number(priority) : null,
    });
  };

  return (
    <li className="flex flex-col gap-2 px-4 py-3 bg-panel-alt/40">
      <input
        ref={inputRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") onCancel(); }}
        className="w-full rounded-lg border border-line bg-panel px-3 py-1.5 text-sm text-ink placeholder:text-ink-faint focus:border-signal focus:outline-none"
      />
      <div className="flex flex-wrap items-center gap-2">
        {/* Fecha límite */}
        <input
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
          className="rounded-lg border border-line bg-panel px-2 py-1 text-xs text-ink focus:border-signal focus:outline-none"
        />
        {/* Prioridad */}
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="rounded-lg border border-line bg-panel px-2 py-1 text-xs text-ink focus:border-signal focus:outline-none"
        >
          <option value="">Sin prioridad</option>
          <option value="3">Alta</option>
          <option value="2">Media</option>
          <option value="1">Baja</option>
        </select>
        <div className="ml-auto flex gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg px-3 py-1 text-xs font-medium text-ink-soft hover:text-ink transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!text.trim()}
            className="rounded-lg bg-signal px-3 py-1 text-xs font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-40 cursor-pointer"
          >
            Guardar
          </button>
        </div>
      </div>
    </li>
  );
}

// ── Single todo row ─────────────────────────────────────────────────────────────

function TodoRow({ item, onToggle, onDelete, onEdit }) {
  const due = formatDue(item.due_date);
  const pri = item.priority ? PRIORITY_CONFIG[item.priority] : null;

  return (
    <li className="group flex items-start gap-3 px-4 py-3 hover:bg-panel-alt/30 transition-colors">
      {/* Checkbox */}
      <button
        onClick={() => onToggle(item.id)}
        aria-label={item.done ? "Marcar pendiente" : "Marcar hecho"}
        className={[
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors cursor-pointer",
          item.done
            ? "border-mint bg-mint text-white"
            : "border-line bg-transparent hover:border-mint",
        ].join(" ")}
      >
        {item.done && <Check size={11} strokeWidth={3} />}
      </button>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className={[
          "text-sm leading-snug",
          item.done ? "text-ink-faint line-through" : "text-ink",
        ].join(" ")}>
          {item.text}
        </p>

        {/* Meta badges */}
        {(due || pri) && (
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {due && (
              <span className={[
                "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                due.overdue
                  ? "bg-coral-soft text-coral"
                  : "bg-panel-alt text-ink-soft",
              ].join(" ")}>
                <Calendar size={9} />
                {due.label}
              </span>
            )}
            {pri && (
              <span className={[
                "flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium",
                pri.bg, pri.color, pri.border,
              ].join(" ")}>
                <Flag size={9} />
                {pri.label}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Actions — visible on hover */}
      <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!item.done && (
          <button
            onClick={() => onEdit(item)}
            className="rounded-lg p-1.5 text-ink-faint hover:bg-panel-alt hover:text-ink transition-colors cursor-pointer"
            aria-label="Editar"
          >
            <Pencil size={13} />
          </button>
        )}
        <button
          onClick={() => onDelete(item.id)}
          className="rounded-lg p-1.5 text-ink-faint hover:bg-coral-soft hover:text-coral transition-colors cursor-pointer"
          aria-label="Eliminar"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </li>
  );
}

// ── Add form ───────────────────────────────────────────────────────────────────

function AddForm({ onAdd }) {
  const [text, setText]         = useState("");
  const [due, setDue]           = useState("");
  const [priority, setPriority] = useState("");
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    await onAdd({
      text: text.trim(),
      due_date: due || null,
      priority: priority ? Number(priority) : null,
    });
    setText("");
    setDue("");
    setPriority("");
    setExpanded(false);
    inputRef.current?.focus();
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-line bg-panel shadow-xs overflow-hidden">
      {/* Main input row */}
      <div className="flex items-center gap-2 px-4 py-3">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-line text-ink-faint">
          <Plus size={11} strokeWidth={3} />
        </span>
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Añadir tarea…"
          className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none"
        />
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="rounded-lg p-1 text-ink-faint hover:text-ink transition-colors cursor-pointer"
          aria-label="Más opciones"
        >
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      </div>

      {/* Extra options */}
      {expanded && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-2.5 bg-panel-alt/30">
          <input
            type="date"
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="rounded-lg border border-line bg-panel px-2 py-1 text-xs text-ink focus:border-signal focus:outline-none"
          />
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="rounded-lg border border-line bg-panel px-2 py-1 text-xs text-ink focus:border-signal focus:outline-none"
          >
            <option value="">Sin prioridad</option>
            <option value="3">Alta</option>
            <option value="2">Media</option>
            <option value="1">Baja</option>
          </select>
        </div>
      )}

      {/* Submit */}
      {text.trim() && (
        <div className="border-t border-line px-4 py-2.5 flex justify-end bg-panel-alt/20">
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-xl bg-signal px-4 py-1.5 text-xs font-semibold text-white hover:opacity-90 transition-opacity cursor-pointer"
          >
            <Plus size={13} strokeWidth={2.5} />
            Agregar
          </button>
        </div>
      )}
    </form>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function Todos() {
  const { pending, done, loading, error, addTodo, toggleDone, updateTodo, deleteTodo, clearDone } = useTodos();
  const [editingItem, setEditingItem] = useState(null);
  const [doneExpanded, setDoneExpanded] = useState(false);

  const handleEdit = async (changes) => {
    await updateTodo(editingItem.id, changes);
    setEditingItem(null);
  };

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-mono text-2xl font-bold tracking-tight text-ink">Pendientes</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Apunta tareas y recordatorios rápidos.
          </p>
        </div>
        {done.length > 0 && (
          <button
            onClick={clearDone}
            className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-1.5 text-xs font-medium text-ink-soft hover:border-coral/50 hover:text-coral transition-colors cursor-pointer"
          >
            <X size={12} />
            Limpiar completadas
          </button>
        )}
      </div>

      {/* Add form */}
      <AddForm onAdd={addTodo} />

      <div className="mt-4 flex flex-col gap-3">
        {/* Loading / error */}
        {loading && (
          <p className="py-6 text-center text-sm text-ink-soft">Cargando…</p>
        )}
        {error && (
          <p className="rounded-lg bg-coral-soft px-4 py-3 text-sm text-coral">{error}</p>
        )}

        {/* Pending list */}
        {!loading && pending.length === 0 && done.length === 0 && (
          <div className="rounded-2xl border border-dashed border-line px-5 py-12 text-center">
            <p className="text-sm text-ink-soft">No tienes tareas pendientes.</p>
            <p className="mt-1 text-xs text-ink-faint">Usa el campo de arriba para añadir una.</p>
          </div>
        )}

        {pending.length > 0 && (
          <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-panel shadow-xs">
            {pending.map((item) =>
              editingItem?.id === item.id ? (
                <EditRow
                  key={item.id}
                  item={item}
                  onSave={handleEdit}
                  onCancel={() => setEditingItem(null)}
                />
              ) : (
                <TodoRow
                  key={item.id}
                  item={item}
                  onToggle={toggleDone}
                  onDelete={deleteTodo}
                  onEdit={setEditingItem}
                />
              )
            )}
          </ul>
        )}

        {/* Completed accordion */}
        {done.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-line bg-panel shadow-xs">
            <button
              type="button"
              onClick={() => setDoneExpanded((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-sm text-ink-soft hover:bg-panel-alt/40 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2 font-medium">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-mint/20 text-mint">
                  <Check size={11} strokeWidth={3} />
                </span>
                Completadas
                <span className="rounded-full bg-panel-alt border border-line px-2 py-0.5 text-xs font-semibold text-ink-faint">
                  {done.length}
                </span>
              </span>
              {doneExpanded
                ? <ChevronUp size={16} className="text-ink-faint" />
                : <ChevronDown size={16} className="text-ink-faint" />
              }
            </button>

            {doneExpanded && (
              <ul className="divide-y divide-line border-t border-line">
                {done.map((item) => (
                  <TodoRow
                    key={item.id}
                    item={item}
                    onToggle={toggleDone}
                    onDelete={deleteTodo}
                    onEdit={setEditingItem}
                  />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
