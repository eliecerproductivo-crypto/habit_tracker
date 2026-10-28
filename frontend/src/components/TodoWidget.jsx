import { useState } from "react";
import { CheckSquare, Plus, Check, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useTodos } from "../hooks/useTodos";
import { todayLocalISODate } from "../lib/schedule";

/**
 * Widget compacto del Dashboard que muestra las tareas pendientes relevantes para hoy:
 * - Tareas con due_date = hoy
 * - Tareas sin due_date (sin fecha límite, siempre visibles)
 * Solo se muestran las primeras MAX_VISIBLE; el resto se ve en /pendientes.
 */
const MAX_VISIBLE = 4;

export default function TodoWidget() {
  const { pending, loading, addTodo, toggleDone } = useTodos();
  const [newText, setNewText] = useState("");
  const [adding, setAdding]   = useState(false);

  const today = todayLocalISODate();

  // Tareas relevantes para hoy: sin fecha o con due_date <= hoy
  const todayTodos = pending.filter((t) => !t.due_date || t.due_date <= today);
  const visible    = todayTodos.slice(0, MAX_VISIBLE);
  const overflow   = todayTodos.length - MAX_VISIBLE;

  const handleAdd = async (e) => {
    e.preventDefault();
    const text = newText.trim();
    if (!text) return;
    setAdding(true);
    try {
      await addTodo({ text });
      setNewText("");
    } finally {
      setAdding(false);
    }
  };

  if (loading) return null; // no mostrar skeleton en el dashboard

  // Si no hay tareas relevantes y el input está cerrado, mostrar placeholder minimalista
  if (todayTodos.length === 0 && newText === "") {
    return (
      <div className="rounded-2xl border border-line bg-panel p-4 shadow-xs">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <CheckSquare size={15} className="text-ink-faint" />
            <span className="text-sm font-semibold text-ink">Pendientes</span>
          </div>
          <Link to="/pendientes" className="text-xs text-ink-faint hover:text-ink transition-colors">
            Ver todos
          </Link>
        </div>
        <form onSubmit={handleAdd} className="flex items-center gap-2">
          <input
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Añadir tarea rápida…"
            className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none"
          />
          {newText.trim() && (
            <button
              type="submit"
              disabled={adding}
              className="shrink-0 rounded-lg bg-signal px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90 cursor-pointer disabled:opacity-50"
            >
              {adding ? "…" : "Añadir"}
            </button>
          )}
        </form>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-panel shadow-xs overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 pt-3.5 pb-2">
        <div className="flex items-center gap-2">
          <CheckSquare size={15} className="text-ink-faint" />
          <span className="text-sm font-semibold text-ink">Pendientes</span>
          {todayTodos.length > 0 && (
            <span className="rounded-full bg-signal-soft px-2 py-0.5 text-[10px] font-semibold text-signal">
              {todayTodos.length}
            </span>
          )}
        </div>
        <Link
          to="/pendientes"
          className="flex items-center gap-1 text-xs text-ink-faint hover:text-ink transition-colors"
        >
          Ver todos <ArrowRight size={12} />
        </Link>
      </div>

      {/* Lista */}
      <ul className="divide-y divide-line border-t border-line">
        {visible.map((item) => (
          <li key={item.id} className="flex items-center gap-3 px-4 py-2.5">
            <button
              onClick={() => toggleDone(item.id)}
              aria-label="Completar tarea"
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-line hover:border-mint transition-colors cursor-pointer"
            >
              {/* vacío — al hacer clic se marca done y desaparece del widget */}
            </button>
            <span className="flex-1 text-sm text-ink truncate">{item.text}</span>
            {item.due_date === today && (
              <span className="shrink-0 rounded-full bg-signal-soft px-2 py-0.5 text-[10px] font-medium text-signal">
                Hoy
              </span>
            )}
          </li>
        ))}

        {overflow > 0 && (
          <li className="px-4 py-2">
            <Link
              to="/pendientes"
              className="text-xs text-ink-faint hover:text-signal transition-colors"
            >
              +{overflow} más en la lista completa
            </Link>
          </li>
        )}
      </ul>

      {/* Input añadir rápido */}
      <form
        onSubmit={handleAdd}
        className="flex items-center gap-2 border-t border-line px-4 py-2.5 bg-panel-alt/30"
      >
        <Plus size={13} className="shrink-0 text-ink-faint" />
        <input
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="Añadir tarea rápida…"
          className="flex-1 bg-transparent text-sm text-ink placeholder:text-ink-faint focus:outline-none"
        />
        {newText.trim() && (
          <button
            type="submit"
            disabled={adding}
            className="shrink-0 rounded-lg bg-signal px-2.5 py-1 text-xs font-semibold text-white hover:opacity-90 cursor-pointer disabled:opacity-50"
          >
            {adding ? "…" : "Añadir"}
          </button>
        )}
      </form>
    </div>
  );
}
