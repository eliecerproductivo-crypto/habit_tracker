import { useState, useEffect } from "react";
import { Sparkles, User, Download, CalendarClock } from "lucide-react";
import { useProfile } from "../hooks/useProfile";
import api from "../api/client";

// ── Componente de pestañas ────────────────────────────────────────────────────
function Tabs({ active, onChange }) {
  const tabs = [
    { id: "perfil", label: "Mi perfil", icon: <User size={14} /> },
    { id: "rutina", label: "Mi rutina", icon: <CalendarClock size={14} /> },
  ];
  return (
    <div className="flex gap-1 rounded-xl bg-panel-alt p-1 border border-line w-fit">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={[
            "flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer",
            active === tab.id
              ? "bg-panel text-ink shadow-sm border border-line"
              : "text-ink-faint hover:text-ink",
          ].join(" ")}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export default function Profile() {
  const { bio, bioSummary, routine, loading, error, saveBio, summarizeBio, saveRoutine } = useProfile();

  const [activeTab, setActiveTab] = useState("perfil");

  // ── Estado: pestaña Perfil ────────────────────────────────────────────────
  const [bioText, setBioText] = useState("");
  const [savingBio, setSavingBio] = useState(false);
  const [savedBio, setSavedBio] = useState(false);
  const [saveBioError, setSaveBioError] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const [summarizeError, setSummarizeError] = useState("");

  // ── Estado: pestaña Rutina ────────────────────────────────────────────────
  const [routineText, setRoutineText] = useState("");
  const [savingRoutine, setSavingRoutine] = useState(false);
  const [savedRoutine, setSavedRoutine] = useState(false);
  const [saveRoutineError, setSaveRoutineError] = useState("");

  // ── Estado: exportar ──────────────────────────────────────────────────────
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");

  // Sincronizar textarea cuando carga el perfil
  useEffect(() => {
    if (!loading) {
      setBioText(bio);
      setRoutineText(routine);
    }
  }, [loading, bio, routine]);

  // ── Handlers: perfil ──────────────────────────────────────────────────────
  const handleSaveBio = async () => {
    if (!bioText.trim()) return;
    setSavingBio(true);
    setSaveBioError("");
    try {
      await saveBio(bioText.trim());
      setSavedBio(true);
      setTimeout(() => setSavedBio(false), 2500);
    } catch (err) {
      setSaveBioError(err?.response?.data?.detail || "No se pudo guardar.");
    } finally {
      setSavingBio(false);
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

  // ── Handlers: rutina ──────────────────────────────────────────────────────
  const handleSaveRoutine = async () => {
    setSavingRoutine(true);
    setSaveRoutineError("");
    try {
      await saveRoutine(routineText.trim());
      setSavedRoutine(true);
      setTimeout(() => setSavedRoutine(false), 2500);
    } catch (err) {
      setSaveRoutineError(err?.response?.data?.detail || "No se pudo guardar.");
    } finally {
      setSavingRoutine(false);
    }
  };

  // ── Handler: exportar ─────────────────────────────────────────────────────
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

  if (loading) return <p className="text-sm text-ink-soft">Cargando…</p>;

  return (
    <div className="flex flex-col gap-6 max-w-2xl">

      {/* Encabezado */}
      <div>
        <h1 className="text-lg font-semibold">Mi información</h1>
        <p className="text-sm text-ink-soft mt-0.5">
          Cuéntale a tu coach quién eres y cómo es tu día. Esto personaliza todas las conversaciones con la IA.
        </p>
      </div>

      {/* Pestañas */}
      <Tabs active={activeTab} onChange={setActiveTab} />

      {/* ── Pestaña: Mi perfil ───────────────────────────────────────────── */}
      {activeTab === "perfil" && (
        <>
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
              value={bioText}
              onChange={(e) => setBioText(e.target.value)}
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
              <span className="text-xs text-ink-faint">{bioText.length}/5000</span>
              <div className="flex items-center gap-2">
                {savedBio && <span className="text-xs text-mint font-medium">¡Guardado!</span>}
                {saveBioError && <span className="text-xs text-coral">{saveBioError}</span>}
                <button
                  onClick={handleSaveBio}
                  disabled={savingBio || !bioText.trim()}
                  className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
                >
                  {savingBio ? "Guardando…" : "Guardar"}
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
                  Guarda tu perfil y presiona "Generar" para que la IA extraiga lo esencial.
                </p>
              </div>
            )}
          </div>

          {error && <p className="rounded-lg bg-coral-soft px-3 py-2 text-sm text-coral">{error}</p>}
        </>
      )}

      {/* ── Pestaña: Mi rutina ───────────────────────────────────────────── */}
      {activeTab === "rutina" && (
        <div className="rounded-2xl border border-line bg-panel p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400">
              <CalendarClock size={15} />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink">Mi rutina diaria</p>
              <p className="text-xs text-ink-faint">
                Describe cómo es tu día típico: horarios, estructura, compromisos fijos
              </p>
            </div>
          </div>

          <textarea
            value={routineText}
            onChange={(e) => setRoutineText(e.target.value)}
            placeholder={
              "Describe tu rutina tal cual es. Por ejemplo:\n\n" +
              "Me levanto a las 6:30. De 7:00 a 8:00 hago ejercicio. " +
              "Trabajo de 9:00 a 18:00 con una hora de almuerzo a las 13:00. " +
              "Por las noches estudio de 20:00 a 21:30. Me duermo a las 23:00…"
            }
            rows={10}
            maxLength={5000}
            className="w-full resize-none rounded-lg border border-line bg-bg px-3 py-2.5 text-sm text-ink outline-none focus:border-signal placeholder:text-ink-faint leading-relaxed"
          />

          <p className="text-xs text-ink-faint">
            Tu coach usará esto para darte recomendaciones más ajustadas a tu día real, no solo a tus hábitos registrados.
          </p>

          <div className="flex items-center justify-between">
            <span className="text-xs text-ink-faint">{routineText.length}/5000</span>
            <div className="flex items-center gap-2">
              {savedRoutine && <span className="text-xs text-mint font-medium">¡Guardado!</span>}
              {saveRoutineError && <span className="text-xs text-coral">{saveRoutineError}</span>}
              <button
                onClick={handleSaveRoutine}
                disabled={savingRoutine}
                className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
              >
                {savingRoutine ? "Guardando…" : "Guardar rutina"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Exportar datos (siempre visible) ────────────────────────────── */}
      <div className="rounded-2xl border border-line bg-panel p-5 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-mint-soft text-mint">
            <Download size={15} />
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">Exportar todos mis datos</p>
            <p className="text-xs text-ink-faint">
              Descarga tus hábitos, historial, diario, sesiones y perfil en un ZIP con CSVs listos para Excel.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md bg-bg border border-line px-2 py-0.5 text-xs text-ink-faint">habitos.csv</span>
          <span className="rounded-md bg-bg border border-line px-2 py-0.5 text-xs text-ink-faint">historial_habitos.csv</span>
          <span className="rounded-md bg-bg border border-line px-2 py-0.5 text-xs text-ink-faint">sesiones_temporizador.csv</span>
          <span className="rounded-md bg-bg border border-line px-2 py-0.5 text-xs text-ink-faint">diario.csv</span>
          <span className="rounded-md bg-bg border border-line px-2 py-0.5 text-xs text-ink-faint">perfil.csv</span>
        </div>

        {exportError && (
          <p className="rounded-lg bg-coral-soft px-3 py-2 text-sm text-coral">{exportError}</p>
        )}

        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex w-fit items-center gap-2 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-50 cursor-pointer"
        >
          <Download size={14} />
          {exporting ? "Preparando descarga…" : "Descargar todos mis datos (.ZIP)"}
        </button>
      </div>
    </div>
  );
}
