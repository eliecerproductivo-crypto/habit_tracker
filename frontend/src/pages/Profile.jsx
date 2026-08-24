import { useState, useEffect } from "react";
import { Sparkles, User } from "lucide-react";
import { useProfile } from "../hooks/useProfile";

export default function Profile() {
  const { bio, bioSummary, loading, error, saveBio, summarizeBio } = useProfile();
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [summarizing, setSummarizing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [summarizeError, setSummarizeError] = useState("");

  // Sincronizar el textarea cuando carga el perfil
  useEffect(() => {
    if (!loading) setText(bio);
  }, [loading, bio]);

  const handleSave = async () => {
    if (!text.trim()) return;
    setSaving(true);
    setSaveError("");
    try {
      await saveBio(text.trim());
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setSaveError(err?.response?.data?.detail || "No se pudo guardar.");
    } finally {
      setSaving(false);
    }
  };

  const handleSummarize = async () => {
    setSummarizing(true);
    setSummarizeError("");
    try {
      await summarizeBio();
    } catch (err) {
      setSummarizeError(err?.response?.data?.detail || "No se pudo generar el resumen.");
    } finally {
      setSummarizing(false);
    }
  };

  if (loading) return <p className="text-sm text-ink-soft">Cargando…</p>;

  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-lg font-semibold">Mi perfil</h1>
        <p className="text-sm text-ink-soft mt-0.5">
          Cuéntale a tu coach quién eres. Esto enriquece todas las conversaciones con la IA.
        </p>
      </div>

      {/* Editor de bio */}
      <div className="rounded-2xl border border-line bg-panel p-5 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-soft text-violet">
            <User size={15} />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">Sobre mí</p>
            <p className="text-xs text-ink-faint">Quién eres, tus objetivos, valores e intereses</p>
          </div>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            "Escribe libremente sobre ti. Por ejemplo:\n\n" +
            "Soy [nombre], quiero ser [objetivo]. Me apasiona [interés]. " +
            "Mis valores son [valores]. Actualmente estoy trabajando en [proyecto/meta]…"
          }
          rows={8}
          maxLength={5000}
          className="w-full resize-none rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-ink outline-none focus:border-signal placeholder:text-ink-faint leading-relaxed"
        />

        <div className="flex items-center justify-between">
          <span className="text-xs text-ink-faint">{text.length}/5000</span>
          <div className="flex items-center gap-2">
            {saved && <span className="text-xs text-mint font-medium">¡Guardado!</span>}
            {saveError && <span className="text-xs text-coral">{saveError}</span>}
            <button
              onClick={handleSave}
              disabled={saving || !text.trim()}
              className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </div>
      </div>

      {/* Resumen IA */}
      <div className="rounded-2xl border border-line bg-panel p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-violet-soft text-violet">
              <Sparkles size={15} />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">Perfil comprimido para la IA</p>
              <p className="text-xs text-ink-faint">Lo que el coach usa como contexto de ti</p>
            </div>
          </div>
          <button
            onClick={handleSummarize}
            disabled={summarizing || !bio.trim()}
            className="rounded-lg bg-violet px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
          >
            <Sparkles size={12} />
            {summarizing ? "Resumiendo…" : bioSummary ? "Regenerar" : "Generar"}
          </button>
        </div>

        {summarizeError && (
          <p className="rounded-lg bg-coral-soft px-3 py-2 text-sm text-coral">{summarizeError}</p>
        )}

        {bioSummary ? (
          <div className="rounded-lg bg-violet-soft px-4 py-3">
            <p className="text-sm text-ink-soft leading-relaxed">{bioSummary}</p>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-line px-4 py-6 text-center">
            <p className="text-xs text-ink-faint">
              Guarda tu bio y presiona "Generar" para que la IA extraiga lo esencial.
            </p>
          </div>
        )}
      </div>

      {error && <p className="rounded-lg bg-coral-soft px-3 py-2 text-sm text-coral">{error}</p>}
    </div>
  );
}
