import { useState } from "react";
import { Plus } from "lucide-react";
import { useHabits } from "../hooks/useHabits";
import HabitCard from "../components/HabitCard";
import HabitForm from "../components/HabitForm";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";

export default function Habits() {
  const { habits, loading, error, createHabit, updateHabit, deleteHabit } = useHabits();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null); // habit being edited, or null for create
  const [toDelete, setToDelete] = useState(null);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (habit) => {
    setEditing(habit);
    setFormOpen(true);
  };

  const handleSubmit = async (payload) => {
    if (editing) await updateHabit(editing.id, payload);
    else await createHabit(payload);
    setFormOpen(false);
  };

  const handleDelete = async () => {
    await deleteHabit(toDelete.id);
    setToDelete(null);
  };

  return (
    <div className="flex flex-col gap-5">
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

      {!loading && habits.length === 0 && (
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {habits.map((habit) => (
          <HabitCard
            key={habit.id}
            habit={habit}
            onEdit={openEdit}
            onDelete={setToDelete}
          />
        ))}
      </div>

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

      <ConfirmDialog
        open={!!toDelete}
        title="Eliminar hábito"
        message={
          toDelete
            ? `¿Seguro que quieres eliminar "${toDelete.name}"? También se borrará su historial de cumplimiento.`
            : ""
        }
        onConfirm={handleDelete}
        onCancel={() => setToDelete(null)}
      />
    </div>
  );
}
