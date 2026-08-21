import { useState } from "react";
import { UserPlus, Check, X, Trash2, Trophy, Flame, CalendarCheck } from "lucide-react";
import { useFriends } from "../hooks/useFriends";
import { useAuth } from "../context/AuthContext";
import ConfirmDialog from "../components/ConfirmDialog";

function Medal({ rank }) {
  if (rank === 0) return <span className="text-lg">🥇</span>;
  if (rank === 1) return <span className="text-lg">🥈</span>;
  if (rank === 2) return <span className="text-lg">🥉</span>;
  return <span className="font-mono text-sm text-ink-faint">{rank + 1}</span>;
}

export default function Friends() {
  const { user } = useAuth();
  const {
    leaderboard, loading, error,
    pending, accepted, sent,
    sendRequest, acceptRequest, rejectRequest, removeFriend,
  } = useFriends();

  const [emailInput, setEmailInput] = useState("");
  const [sendError, setSendError] = useState("");
  const [sendSuccess, setSendSuccess] = useState("");
  const [sending, setSending] = useState(false);
  const [confirmFriend, setConfirmFriend] = useState(null); // { id, name }

  const handleSend = async (e) => {
    e.preventDefault();
    setSendError("");
    setSendSuccess("");
    if (!emailInput.trim()) return;
    setSending(true);
    try {
      await sendRequest(emailInput.trim());
      setSendSuccess("Solicitud enviada.");
      setEmailInput("");
    } catch (err) {
      setSendError(err?.response?.data?.detail || "No se pudo enviar la solicitud.");
    } finally {
      setSending(false);
    }
  };

  if (loading) return <p className="text-sm text-ink-soft">Cargando…</p>;
  if (error) return <p className="rounded-lg bg-coral-soft px-4 py-3 text-sm text-coral">{error}</p>;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Amigos</h1>
        <p className="text-sm text-ink-soft">Agrega amigos y compara su progreso.</p>
      </div>

      {/* Agregar amigo */}
      <section className="rounded-2xl border border-line bg-panel p-5">
        <h2 className="mb-3 text-sm font-semibold text-ink-soft">Agregar amigo</h2>
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            type="email"
            placeholder="correo@ejemplo.com"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            className="flex-1 rounded-lg border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-signal"
          />
          <button
            type="submit"
            disabled={sending}
            className="flex items-center gap-1.5 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-60 cursor-pointer"
          >
            <UserPlus size={15} />
            {sending ? "Enviando…" : "Agregar"}
          </button>
        </form>
        {sendError && <p className="mt-2 text-xs text-coral">{sendError}</p>}
        {sendSuccess && <p className="mt-2 text-xs text-mint">{sendSuccess}</p>}
      </section>

      {/* Solicitudes pendientes recibidas */}
      {pending.length > 0 && (
        <section className="rounded-2xl border border-signal/30 bg-signal-soft p-5">
          <h2 className="mb-3 text-sm font-semibold text-signal">
            Solicitudes pendientes ({pending.length})
          </h2>
          <ul className="flex flex-col gap-2">
            {pending.map((f) => (
              <li key={f.id} className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-soft font-mono text-xs font-semibold text-violet">
                  {f.friend.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{f.friend.name}</p>
                  <p className="truncate text-xs text-ink-faint">{f.friend.email}</p>
                </div>
                <button
                  onClick={() => acceptRequest(f.id)}
                  title="Aceptar"
                  className="flex h-8 w-8 items-center justify-center rounded-lg bg-mint text-white transition-opacity hover:opacity-80 cursor-pointer"
                >
                  <Check size={15} />
                </button>
                <button
                  onClick={() => rejectRequest(f.id)}
                  title="Rechazar"
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-ink-faint transition-colors hover:bg-coral-soft hover:text-coral cursor-pointer"
                >
                  <X size={15} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Solicitudes enviadas */}
      {sent.length > 0 && (
        <section className="rounded-2xl border border-line bg-panel p-5">
          <h2 className="mb-3 text-sm font-semibold text-ink-soft">Solicitudes enviadas</h2>
          <ul className="flex flex-col gap-2">
            {sent.map((f) => (
              <li key={f.id} className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-soft font-mono text-xs font-semibold text-violet">
                  {f.friend.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{f.friend.name}</p>
                  <p className="truncate text-xs text-ink-faint">{f.friend.email}</p>
                </div>
                <span className="rounded-full bg-panel-alt px-2.5 py-0.5 text-xs text-ink-faint">
                  Pendiente
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Leaderboard */}
      <section className="rounded-2xl border border-line bg-panel p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink-soft">
          <Trophy size={15} className="text-signal" />
          Leaderboard semanal
        </h2>

        {leaderboard.length <= 1 ? (
          <p className="text-center text-sm text-ink-faint py-6">
            Agrega amigos para ver el leaderboard.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-line">
            {leaderboard.map((entry, i) => {
              const isMe = entry.friend.email === user?.email;
              return (
                <li
                  key={entry.friend.id}
                  className={[
                    "flex items-center gap-3 py-3",
                    isMe ? "font-semibold" : "",
                  ].join(" ")}
                >
                  <div className="flex w-7 items-center justify-center">
                    <Medal rank={i} />
                  </div>

                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-soft font-mono text-xs font-semibold text-violet">
                    {entry.friend.name.slice(0, 1).toUpperCase()}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">
                      {entry.friend.name}
                      {isMe && <span className="ml-1.5 text-xs text-ink-faint font-normal">(tú)</span>}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 font-mono text-xs">
                    <span className="flex items-center gap-1 text-coral" title="Racha actual">
                      <Flame size={12} />
                      {entry.current_streak}d
                    </span>
                    <span className="flex items-center gap-1 text-mint" title="Cumplimiento esta semana">
                      <CalendarCheck size={12} />
                      {entry.week_completion_rate}%
                    </span>
                  </div>

                  {/* Botón eliminar amigo (solo para amigos aceptados, no para uno mismo) */}
                  {!isMe && accepted.find((f) => f.friend.id === entry.friend.id) && (
                    <button
                      onClick={() => {
                        const f = accepted.find((x) => x.friend.id === entry.friend.id);
                        if (f) setConfirmFriend({ id: f.id, name: entry.friend.name });
                      }}
                      title="Eliminar amigo"
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-coral-soft hover:text-coral cursor-pointer"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={!!confirmFriend}
        title="Eliminar amigo"
        message={`¿Seguro que quieres eliminar a ${confirmFriend?.name} de tus amigos?`}
        confirmLabel="Eliminar"
        onConfirm={() => { removeFriend(confirmFriend.id); setConfirmFriend(null); }}
        onCancel={() => setConfirmFriend(null)}
      />
    </div>
  );
}
