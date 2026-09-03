import { useState } from "react";
import { Trash2, LogOut, Download } from "lucide-react";
import Modal from "./Modal";
import ConfirmDialog from "./ConfirmDialog";
import { useAuth } from "../context/AuthContext";
import api from "../api/client";

export default function AccountModal({ open, onClose }) {
  const { user, logout, updateProfile, changePassword, deleteAccount } = useAuth();

  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [profileError, setProfileError] = useState("");
  const [profileSuccess, setProfileSuccess] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  const handleExport = async () => {
    setExporting(true);
    setExportError("");
    try {
      const res = await api.get("/profile/export", { responseType: "blob" });
      const today = new Date().toISOString().slice(0, 10);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rutina_export_${today}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError("No se pudo generar la exportación. Intenta de nuevo.");
    } finally {
      setExporting(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-line bg-bg px-3 py-2 text-sm text-ink outline-none focus:border-signal";

  const handleClose = () => {
    setProfileError("");
    setProfileSuccess("");
    setPasswordError("");
    setPasswordSuccess("");
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    onClose();
  };

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileError("");
    setProfileSuccess("");
    if (!name.trim()) {
      setProfileError("Ponle un nombre a tu cuenta.");
      return;
    }
    setSavingProfile(true);
    try {
      await updateProfile(name.trim(), email.trim());
      setProfileSuccess("Perfil actualizado.");
    } catch (err) {
      setProfileError(err?.response?.data?.detail || "No se pudo actualizar el perfil.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");
    if (newPassword.length < 6) {
      setPasswordError("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Las contraseñas no coinciden.");
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword(currentPassword, newPassword);
      setPasswordSuccess("Contraseña actualizada.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordError(err?.response?.data?.detail || "No se pudo actualizar la contraseña.");
    } finally {
      setSavingPassword(false);
    }
  };

  const handleDelete = async () => {
    await deleteAccount();
    setConfirmDelete(false);
  };

  return (
    <>
      <Modal open={open} onClose={handleClose} title="Tu cuenta">
        <div className="flex flex-col gap-6">

          {/* Usuario + logout */}
          <div className="flex items-center gap-3 rounded-xl bg-panel-alt px-4 py-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-soft font-mono text-sm font-semibold text-violet">
              {(user?.name || user?.email || "?").slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{user?.name || "Cuenta"}</p>
              <p className="truncate text-xs text-ink-faint">{user?.email}</p>
            </div>
            <button
              onClick={() => { handleClose(); logout(); }}
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-coral-soft hover:text-coral cursor-pointer"
            >
              <LogOut size={16} />
            </button>
          </div>

          {/* Perfil */}
          <form onSubmit={handleProfileSubmit} className="flex flex-col gap-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Perfil
            </h4>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-soft">Nombre</label>
              <input
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-soft">
                Correo electrónico
              </label>
              <input
                type="email"
                className={inputClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            {profileError && (
              <p className="rounded-lg bg-coral-soft px-3 py-2 text-sm text-coral">
                {profileError}
              </p>
            )}
            {profileSuccess && (
              <p className="rounded-lg bg-mint-soft px-3 py-2 text-sm text-mint">
                {profileSuccess}
              </p>
            )}
            <button
              type="submit"
              disabled={savingProfile}
              className="self-start rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-60 cursor-pointer"
            >
              {savingProfile ? "Guardando…" : "Guardar perfil"}
            </button>
          </form>

          <div className="border-t border-line" />

          {/* Contraseña */}
          <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-3">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Cambiar contraseña
            </h4>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-soft">
                Contraseña actual
              </label>
              <input
                type="password"
                className={inputClass}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-soft">
                Nueva contraseña
              </label>
              <input
                type="password"
                className={inputClass}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-soft">
                Confirmar nueva contraseña
              </label>
              <input
                type="password"
                className={inputClass}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            {passwordError && (
              <p className="rounded-lg bg-coral-soft px-3 py-2 text-sm text-coral">
                {passwordError}
              </p>
            )}
            {passwordSuccess && (
              <p className="rounded-lg bg-mint-soft px-3 py-2 text-sm text-mint">
                {passwordSuccess}
              </p>
            )}
            <button
              type="submit"
              disabled={savingPassword}
              className="self-start rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-60 cursor-pointer"
            >
              {savingPassword ? "Guardando…" : "Actualizar contraseña"}
            </button>
          </form>

          <div className="border-t border-line" />

          {/* Tus datos */}
          <div className="flex flex-col gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
              Tus datos
            </h4>
            <p className="text-xs text-ink-faint">
              Descarga todos tus hábitos, historial, sesiones, diario y perfil en un ZIP con archivos CSV listos para Excel o Google Sheets.
            </p>
            {exportError && (
              <p className="rounded-lg bg-coral-soft px-3 py-2 text-sm text-coral">
                {exportError}
              </p>
            )}
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting}
              className="flex w-fit items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-xs font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              <Download size={13} />
              {exporting ? "Preparando descarga…" : "Descargar todos mis datos (.ZIP)"}
            </button>
          </div>

          <div className="border-t border-line" />

          {/* Zona de peligro */}
          <div className="flex flex-col gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-coral">
              Zona de peligro
            </h4>
            <p className="text-xs text-ink-faint">
              Eliminar tu cuenta borra también todos tus hábitos e historial. Esta acción no se
              puede deshacer.
            </p>
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="flex w-fit items-center gap-1.5 rounded-lg border border-coral/30 px-3 py-1.5 text-xs font-semibold text-coral transition-colors hover:bg-coral-soft cursor-pointer"
            >
              <Trash2 size={13} />
              Eliminar cuenta
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        title="Eliminar cuenta"
        message="¿Seguro que quieres eliminar tu cuenta? Se borrarán todos tus hábitos y tu historial de forma permanente."
        confirmLabel="Eliminar cuenta"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}
