import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { createPortal } from "react-dom";

export default function Modal({ open, onClose, title, children }) {
  const dialogRef = useRef(null);

  // Blur active element before closing so Android keyboard dismisses
  // before the modal unmounts — prevents the dvh viewport jump blank-screen bug
  const handleClose = () => {
    document.activeElement?.blur();
    setTimeout(onClose, 100);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", onKey);
    dialogRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-line bg-panel p-5 shadow-2xl outline-none md:p-6"
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button
            onClick={handleClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-panel-alt hover:text-ink cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
