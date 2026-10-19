import { useState } from "react";
import { Plus, Archive, RotateCcw, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { useHabitsContext } from "../context/HabitsContext";
import HabitCard from "../components/HabitCard";
import HabitForm from "../components/HabitForm";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import HabitStatsModal from "../components/HabitStatsModal";
import api from "../api/client";

export default function Habits() {
  const { habits, loading, error, createHabit, updateHabit, deleteHabit, archiveHabit, restoreHabit } = useHabitsContext();

  const [formOpen, setFormOpen]             = useState(false);
  const [editing, setEditing]               = useState(null);
  const [toArchive, setToArchive]           = useState(null);
  const [toDelete, setToDelete]             = useState(null);
  const [deleteLogCount, setDeleteLogCount] = useState(null);
  const [statsHabit, setStatsHabit]         = useState(null);
  const [archivedExpanded, setArchivedExpanded] = useState(false);

  const activeHabits   = habits.filter((h) => h.is_active !== false);
  const archivedHabits = habits.filter((h) => h.is_active === false);

  const openCreate = () => { setEditing(null); setFormOpen(true); };
  const openEdit   = (habit) => { setEditing(habit); setFormOpen(true); };

  const handleSubmit = async (payload) => {
    if (editing) await updateHabit(editing.id, payload);
    else await createHabit(payload);
    setFormOpen(false);
  };

  // ── Archivar ─────────────────────────────────────────────────────────────
  const handleArchive = async () => {
    await archiveHabit(toArchive.id);
    setToArchive(null);
  };

  // ── Restaurar ────────────────────────────────────────────────────────────
  const handleRestore = async (habit) => {
    await restoreHabit(habit.id);
  };

  // ── Eliminar definitivo (solo archivados) ─────────────────────────────────
  const openDelete = async (habit) => {
    setToDelete(habit);
    setDeleteLogCount(null);
    if (habit.has_logs) {
      try {
        const res = await api.get(`/stats/habit/${habit.id}`);
        setDeleteLogCount(res.data.total_scheduled);
      } catch {
        setDeleteLogCount(-1);
      }
    } else {
      setDeleteLogCount(0);
    }
  };

  const handleDelete = async () => {
    await deleteHabit(toDelete.id);
    setToDelete(null);
    setDeleteLogCount(null);
  };

  const deleteMessage = () => {
    if (!toDelete) return "";
    const base = `¿Eliminar definitivamente "${toDelete.name}"?`;
    if (deleteLogCount === null) return `${base} Calculando historial…`;
    if (deleteLogCount === 0)    return `${base} Este hábito no tiene historial registrado.`;
    if (deleteLogCount === -1)   return `${base} También se borrará todo su historial de cumplimiento.`;
    return `${base} Se perderán ${deleteLogCount} ${deleteLogCount === 1 ? "registro" : "registros"} del historial. Esta acción no se puede deshacer.`;
  };

  return (
    <div className="flex flex-col gap-5">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Tus hábitos</h1>
          <p className="text-sm text-ink-soft">
            Define el horario y los días de cada hábito.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-bg transition-opacity hover:opacity-90 cursor-pointer"
        >
          <Plus size={16} strokeWidth={2.5} />
          Nuevo hábito
        </button>
      </div>

      {loading && <p className="text-sm text-ink-soft">Cargando…</p>}
      {error && (
        <p className="rounded-lg bg-coral-soft px-4 py-3 text-sm text-coral">{error}</p>
      )}

      {/* ── Hábitos activos ── */}
      {!loading && activeHabits.length === 0 && archivedHabits.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line px-5 py-14 text-center">
          <p className="mb-3 text-sm text-ink-soft">
            Todavía no tienes hábitos. Crea el primero para empezar tu rutina.
          </p>
          <button
            onClick={openCreate}
            className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-bg hover:opacity-90 cursor-pointer"
          >
            Crear hábito
          </button>
        </div>
      )}

      {activeHabits.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {activeHabits.map((habit) => (
            <HabitCard
              key={habit.id}
              habit={habit}
              onEdit={openEdit}
              onDelete={setToArchive}
              onStats={setStatsHabit}
              deleteLabel="Archivar"
              deleteIcon={Archive}
            />
          ))}
        </div>
      )}

      {/* ── Acordeón de archivados ── */}
      {archivedHabits.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-line bg-panel shadow-xs">
          <button
            type="button"
            onClick={() => setArchivedExpanded((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3.5 text-sm hover:bg-panel-alt/40 transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-2 font-medium text-ink-soft">
              <Archive size={15} className="text-ink-faint" />
              Archivados
              <span className="rounded-full bg-panel-alt border border-line px-2 py-0.5 text-xs font-semibold text-ink-faint">
                {archivedHabits.length}
              </span>
            </span>
            {archivedExpanded
              ? <ChevronUp size={16} className="text-ink-faint" />
              : <ChevronDown size={16} className="text-ink-faint" />
            }
          </button>

          {archivedExpanded && (
            <div className="border-t border-line px-4 py-4 flex flex-col gap-3">
              <p className="text-xs text-ink-faint">
                Su historial de registros se conserva. Puedes restaurarlos o eliminarlos definitivamente.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {archivedHabits.map((habit) => (
                  <div key={habit.id} className="relative">
                    <HabitCard
                      habit={habit}
                      onStats={setStatsHabit}
                      dimmed
                    />
                    {/* Acciones de archivado */}
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => handleRestore(habit)}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-soft hover:border-mint hover:text-mint transition-colors cursor-pointer"
                      >
                        <RotateCcw size={12} />
                        Restaurar
                      </button>
                      <button
                        onClick={() => openDelete(habit)}
                        className="flex items-center justify-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink-faint hover:border-coral hover:text-coral transition-colors cursor-pointer"
                      >
                        <Trash2 size={12} />
                        Eliminar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Modal crear/editar ── */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Editar hábito" : "Nuevo hábito"}
      >
        <HabitForm
          initial={editing}
          onSubmit={handleSubmit}
          onCancel={() => setFormOpen(false)}
          submitLabel={editing ? "Guardar cambios" : "Crear hábito"}
        />
      </Modal>

      {/* ── Confirmar archivar ── */}
      <ConfirmDialog
        open={!!toArchive}
        title="Archivar hábito"
        message={
          toArchive
            ? `¿Archivar "${toArchive.name}"? Dejará de aparecer en tu plan diario pero su historial se conserva. Puedes restaurarlo cuando quieras.`
            : ""
        }
        confirmLabel="Archivar"
        onConfirm={handleArchive}
        onCancel={() => setToArchive(null)}
      />

      {/* ── Confirmar eliminar definitivo ── */}
      <ConfirmDialog
        open={!!toDelete}
        title="Eliminar definitivamente"
        message={deleteMessage()}
        confirmLabel="Eliminar"
        onConfirm={handleDelete}
        onCancel={() => { setToDelete(null); setDeleteLogCount(null); }}
      />

      {/* ── Stats modal ── */}
      {statsHabit && (
        <HabitStatsModal
          habit={statsHabit}
          onClose={() => setStatsHabit(null)}
        />
      )}
    </div>
  );
}
