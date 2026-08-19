import Modal from "./Modal";

export default function ConfirmDialog({ open, title, message, onConfirm, onCancel, confirmLabel = "Eliminar" }) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <p className="text-sm text-ink-soft">{message}</p>
      <div className="mt-5 flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 rounded-lg border border-line py-2.5 text-sm font-medium text-ink-soft transition-colors hover:bg-panel-alt cursor-pointer"
        >
          Cancelar
        </button>
        <button
          onClick={onConfirm}
          className="flex-1 rounded-lg bg-coral py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 cursor-pointer"
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
