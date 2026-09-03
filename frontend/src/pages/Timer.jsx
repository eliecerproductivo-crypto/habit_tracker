import { useState, useEffect, useRef, useMemo } from "react";
import {
  Play, Pause, RotateCcw, Check, Clock, Flame, Calendar,
  BarChart2, Trash2, Tag, ChevronDown, CheckCircle2, AlertCircle,
  Volume2, VolumeX, Sparkles
} from "lucide-react";
import api from "../api/client";
import { useHabits } from "../hooks/useHabits";
import { todayLocalISODate } from "../lib/schedule";

// Función utilitaria para reproducir un sonido de campanada agradable con Web Audio API
function playCompletionSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // Campana de 3 tonos armónicos suaves
    const tones = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
    tones.forEach((freq, index) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const startTime = ctx.currentTime + index * 0.12;
      const duration = 1.2;

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.2, startTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + duration);
    });
  } catch (e) {
    console.warn("No se pudo reproducir audio:", e);
  }
}

function formatTime(totalSeconds) {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function formatDurationHuman(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const remainingSecs = seconds % 60;
  if (mins < 60) {
    return remainingSecs > 0 ? `${mins}m ${remainingSecs}s` : `${mins} min`;
  }
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hours}h ${remMins}m` : `${hours}h`;
}

function formatHour(isoString) {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function formatDateLabel(isoString) {
  if (!isoString) return "";
  try {
    const d = new Date(isoString);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();
    if (isToday) return "Hoy";
    return d.toLocaleDateString([], { day: "numeric", month: "short" });
  } catch {
    return "";
  }
}

const PRESETS = [
  { label: "25 min", minutes: 25, title: "Pomodoro" },
  { label: "50 min", minutes: 50, title: "Enfoque profundo" },
  { label: "15 min", minutes: 15, title: "Rápido" },
  { label: "5 min", minutes: 5, title: "Descanso" },
];

export default function Timer() {
  const { habits, refresh: refreshHabits } = useHabits();

  // Configuración del timer
  const [selectedHabitId, setSelectedHabitId] = useState("");
  const [targetMinutes, setTargetMinutes] = useState(25);
  const [customMinutes, setCustomMinutes] = useState("");
  const [remainingSeconds, setRemainingSeconds] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Registro de sesión en curso
  const [sessionStartTime, setSessionStartTime] = useState(null);
  const [pausedElapsedSeconds, setPausedElapsedSeconds] = useState(0);

  // Modal para guardar sesión terminada
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [sessionToSave, setSessionToSave] = useState(null);
  const [saveNotes, setSaveNotes] = useState("");
  const [autoMarkDone, setAutoMarkDone] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Historial y Estadísticas
  const [sessions, setSessions] = useState([]);
  const [stats, setStats] = useState(null);
  const [loadingData, setLoadingData] = useState(false);
  const [activeTab, setActiveTab] = useState("timer"); // "timer" | "history"

  // Hábitos activos
  const activeHabits = useMemo(() => {
    return (habits || []).filter((h) => h.is_active);
  }, [habits]);

  // Hábito actualmente seleccionado
  const selectedHabit = useMemo(() => {
    return activeHabits.find((h) => h.id === Number(selectedHabitId)) || null;
  }, [activeHabits, selectedHabitId]);

  // Cargar estadísticas y sesiones
  const loadHistoryAndStats = async () => {
    setLoadingData(true);
    try {
      const [sessionsRes, statsRes] = await Promise.all([
        api.get("/timer/sessions", { params: { limit: 20 } }),
        api.get("/timer/stats"),
      ]);
      setSessions(sessionsRes.data);
      setStats(statsRes.data);
    } catch (err) {
      console.error("Error al cargar datos del timer:", err);
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    loadHistoryAndStats();
  }, []);

  // Timer Tick Interval
  const timerRef = useRef(null);

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            handleTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, sessionStartTime, targetMinutes]);

  // Actualizar el título de la pestaña con la cuenta regresiva
  useEffect(() => {
    if (isRunning) {
      document.title = `(${formatTime(remainingSeconds)}) Pomodoro - Rutina`;
    } else {
      document.title = "Timer - Rutina";
    }
  }, [isRunning, remainingSeconds]);

  // Manejar cuando llega a 00:00
  const handleTimerComplete = () => {
    setIsRunning(false);
    if (soundEnabled) {
      playCompletionSound();
    }
    const endTime = new Date();
    const startTime = sessionStartTime || new Date(endTime.getTime() - targetMinutes * 60 * 1000);
    const durationSecs = targetMinutes * 60;

    setSessionToSave({
      habit_id: selectedHabitId ? Number(selectedHabitId) : null,
      habit_name: selectedHabit ? selectedHabit.name : "Sesión general",
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      duration_seconds: durationSecs,
      session_type: "pomodoro",
    });
    setSaveModalOpen(true);
  };

  // Iniciar timer
  const handleStart = () => {
    if (!sessionStartTime) {
      setSessionStartTime(new Date());
    }
    setIsRunning(true);
  };

  // Pausar timer
  const handlePause = () => {
    setIsRunning(false);
  };

  // Reiniciar timer
  const handleReset = () => {
    setIsRunning(false);
    setRemainingSeconds(targetMinutes * 60);
    setSessionStartTime(null);
    setPausedElapsedSeconds(0);
  };

  // Cambiar duración preset
  const handleSelectPreset = (mins) => {
    if (isRunning) return;
    setTargetMinutes(mins);
    setRemainingSeconds(mins * 60);
    setSessionStartTime(null);
    setCustomMinutes("");
  };

  // Aplicar minutos personalizados
  const handleApplyCustomMinutes = (e) => {
    e.preventDefault();
    const val = parseInt(customMinutes, 10);
    if (val && val > 0 && val <= 360) {
      if (isRunning) return;
      setTargetMinutes(val);
      setRemainingSeconds(val * 60);
      setSessionStartTime(null);
    }
  };

  // Finalizar antes de tiempo y registrar lo trabajado
  const handleFinishEarly = () => {
    if (!sessionStartTime && remainingSeconds === targetMinutes * 60) return;
    const endTime = new Date();
    const totalDuration = targetMinutes * 60;
    const elapsed = Math.max(1, totalDuration - remainingSeconds);

    setIsRunning(false);

    setSessionToSave({
      habit_id: selectedHabitId ? Number(selectedHabitId) : null,
      habit_name: selectedHabit ? selectedHabit.name : "Sesión general",
      start_time: (sessionStartTime || new Date(endTime.getTime() - elapsed * 1000)).toISOString(),
      end_time: endTime.toISOString(),
      duration_seconds: elapsed,
      session_type: "pomodoro",
    });
    setSaveModalOpen(true);
  };

  // Confirmar y guardar la sesión
  const handleSaveSession = async () => {
    if (!sessionToSave) return;
    setIsSaving(true);
    try {
      await api.post("/timer/sessions", {
        habit_id: sessionToSave.habit_id,
        start_time: sessionToSave.start_time,
        end_time: sessionToSave.end_time,
        duration_seconds: sessionToSave.duration_seconds,
        session_type: sessionToSave.session_type,
        notes: saveNotes.trim(),
        auto_mark_done: autoMarkDone && !!sessionToSave.habit_id,
        log_date: todayLocalISODate(),
      });

      // Recargar datos y resetear
      await loadHistoryAndStats();
      if (autoMarkDone && sessionToSave.habit_id) {
        refreshHabits();
      }

      setSaveModalOpen(false);
      setSessionToSave(null);
      setSaveNotes("");
      handleReset();
    } catch (err) {
      alert("Error al guardar la sesión: " + (err?.response?.data?.detail || err.message));
    } finally {
      setIsSaving(false);
    }
  };

  // Eliminar una sesión guardada
  const handleDeleteSession = async (sessionId) => {
    if (!window.confirm("¿Eliminar este registro de tiempo?")) return;
    try {
      await api.delete(`/timer/sessions/${sessionId}`);
      loadHistoryAndStats();
    } catch (err) {
      alert("Error al eliminar la sesión.");
    }
  };

  // Porcentaje completado para el dial
  const totalTargetSecs = targetMinutes * 60;
  const progressPercent = Math.min(
    100,
    Math.max(0, ((totalTargetSecs - remainingSeconds) / totalTargetSecs) * 100)
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 pb-24 md:pb-12">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line pb-6">
        <div>
          <h1 className="font-mono text-2xl font-bold tracking-tight text-ink">
            Temporizador de Enfoque
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            Dedica bloques de tiempo a tus hábitos y registra cuándo comenzaste y terminaste.
          </p>
        </div>

        {/* Pestañas para mobile y desktop */}
        <div className="flex items-center gap-1 rounded-xl bg-panel-alt p-1 border border-line">
          <button
            onClick={() => setActiveTab("timer")}
            className={[
              "flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer",
              activeTab === "timer"
                ? "bg-panel text-signal shadow-sm"
                : "text-ink-soft hover:text-ink",
            ].join(" ")}
          >
            <Clock size={15} />
            Reloj
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={[
              "flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer",
              activeTab === "history"
                ? "bg-panel text-signal shadow-sm"
                : "text-ink-soft hover:text-ink",
            ].join(" ")}
          >
            <BarChart2 size={15} />
            Estadísticas & Historial
          </button>
        </div>
      </div>

      {/* ─── VISTA DEL RELOJ ─── */}
      {activeTab === "timer" && (
        <div className="mt-8 space-y-8">
          {/* Card Principal del Temporizador */}
          <div className="relative overflow-hidden rounded-2xl border border-line bg-panel p-6 shadow-sm md:p-10">
            {/* Selector de Hábito */}
            <div className="mx-auto max-w-md">
              <label className="block text-xs font-semibold uppercase tracking-wider text-ink-faint mb-2 text-center">
                ¿A qué hábito le dedicarás este tiempo?
              </label>
              <div className="relative">
                <select
                  disabled={isRunning}
                  value={selectedHabitId}
                  onChange={(e) => {
                    const hId = e.target.value;
                    setSelectedHabitId(hId);
                    const found = activeHabits.find((h) => h.id === Number(hId));
                    if (found && found.duration_minutes && !isRunning) {
                      setTargetMinutes(found.duration_minutes);
                      setRemainingSeconds(found.duration_minutes * 60);
                      setSessionStartTime(null);
                    }
                  }}
                  className="w-full appearance-none rounded-xl border border-line bg-panel-alt px-4 py-3 pr-10 text-sm font-medium text-ink focus:border-signal focus:outline-none focus:ring-1 focus:ring-signal transition-colors cursor-pointer disabled:opacity-75"
                >
                  <option value="">🎯 General / Sin hábito específico</option>
                  {activeHabits.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name} {h.category ? `(${h.category})` : ""}
                      {h.duration_minutes ? ` • ${h.duration_minutes} min` : ""}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={18}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint"
                />
              </div>

              {selectedHabit && (
                <div className="mt-2.5 flex items-center justify-center gap-2 text-xs text-ink-soft">
                  <span className="inline-block h-2 w-2 rounded-full bg-signal" />
                  <span>Categoría: <strong className="text-ink">{selectedHabit.category}</strong></span>
                  {selectedHabit.description && (
                    <span className="truncate max-w-[200px] text-ink-faint">
                      — {selectedHabit.description}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Presets de Duración */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
              {PRESETS.map((p) => {
                const isActive = targetMinutes === p.minutes && !customMinutes;
                return (
                  <button
                    key={p.minutes}
                    disabled={isRunning}
                    onClick={() => handleSelectPreset(p.minutes)}
                    className={[
                      "rounded-xl px-4 py-2 text-xs font-semibold transition-all cursor-pointer disabled:cursor-not-allowed",
                      isActive
                        ? "bg-signal text-white shadow-sm"
                        : "bg-panel-alt text-ink-soft hover:bg-line/60 hover:text-ink disabled:opacity-60",
                    ].join(" ")}
                  >
                    {p.label}
                  </button>
                );
              })}

              {/* Minutos manuales */}
              <form onSubmit={handleApplyCustomMinutes} className="flex items-center">
                <input
                  type="number"
                  min="1"
                  max="360"
                  placeholder="Min..."
                  disabled={isRunning}
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(e.target.value)}
                  className="w-20 rounded-l-xl border border-line bg-panel-alt px-3 py-2 text-xs font-medium text-ink focus:border-signal focus:outline-none disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={isRunning || !customMinutes}
                  className="rounded-r-xl border-y border-r border-line bg-panel-alt px-3 py-2 text-xs font-semibold text-ink-soft hover:text-signal disabled:opacity-50 cursor-pointer"
                >
                  Fijar
                </button>
              </form>
            </div>

            {/* Dial Circular del Reloj */}
            <div className="mt-10 flex flex-col items-center justify-center">
              <div className="relative flex h-64 w-64 items-center justify-center">
                {/* SVG Dial */}
                <svg className="h-full w-full -rotate-90 transform" viewBox="0 0 100 100">
                  {/* Track de fondo */}
                  <circle
                    cx="50"
                    cy="50"
                    r="44"
                    className="text-panel-alt stroke-current"
                    strokeWidth="6"
                    fill="transparent"
                  />
                  {/* Progreso */}
                  <circle
                    cx="50"
                    cy="50"
                    r="44"
                    className="text-signal stroke-current transition-all duration-1000 ease-linear"
                    strokeWidth="6"
                    strokeDasharray={276.46}
                    strokeDashoffset={276.46 - (276.46 * progressPercent) / 100}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                </svg>

                {/* Contenido dentro del dial */}
                <div className="absolute flex flex-col items-center justify-center text-center">
                  <span className="font-mono text-5xl font-bold tracking-tight text-ink">
                    {formatTime(remainingSeconds)}
                  </span>
                  <span className="mt-1 text-xs font-semibold uppercase tracking-wider text-ink-faint">
                    {isRunning ? "Enfocado" : remainingSeconds === 0 ? "Completado" : "Listo"}
                  </span>
                  {sessionStartTime && (
                    <span className="mt-1 font-mono text-[11px] text-ink-soft">
                      Iniciado: {formatHour(sessionStartTime.toISOString())}
                    </span>
                  )}
                </div>
              </div>

              {/* Botón de Silencio / Sonido */}
              <button
                onClick={() => setSoundEnabled((v) => !v)}
                title={soundEnabled ? "Sonido activado al finalizar" : "Sonido desactivado"}
                className="mt-4 flex items-center gap-1.5 text-xs text-ink-faint hover:text-ink transition-colors cursor-pointer"
              >
                {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
                <span>{soundEnabled ? "Campana activada" : "Silencio"}</span>
              </button>
            </div>

            {/* Controles Principales */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {!isRunning ? (
                <button
                  onClick={handleStart}
                  className="flex items-center gap-2 rounded-xl bg-signal px-8 py-3.5 text-sm font-semibold text-white shadow-md hover:opacity-95 transition-all cursor-pointer"
                >
                  <Play size={18} fill="currentColor" />
                  {remainingSeconds < totalTargetSecs ? "Reanudar" : "Comenzar Sesión"}
                </button>
              ) : (
                <button
                  onClick={handlePause}
                  className="flex items-center gap-2 rounded-xl bg-panel-alt border border-line px-7 py-3.5 text-sm font-semibold text-ink hover:bg-line/40 transition-all cursor-pointer"
                >
                  <Pause size={18} fill="currentColor" />
                  Pausar
                </button>
              )}

              {/* Reiniciar */}
              {(remainingSeconds < totalTargetSecs || sessionStartTime) && (
                <button
                  onClick={handleReset}
                  title="Reiniciar temporizador"
                  className="flex items-center gap-1.5 rounded-xl border border-line bg-panel-alt px-4 py-3.5 text-sm font-medium text-ink-soft hover:text-coral transition-colors cursor-pointer"
                >
                  <RotateCcw size={16} />
                  Reiniciar
                </button>
              )}

              {/* Terminar antes y guardar */}
              {sessionStartTime && (
                <button
                  onClick={handleFinishEarly}
                  title="Guardar el tiempo trabajado hasta el momento"
                  className="flex items-center gap-1.5 rounded-xl border border-mint/40 bg-mint-soft px-5 py-3.5 text-sm font-semibold text-mint hover:bg-mint-soft/80 transition-colors cursor-pointer"
                >
                  <Check size={16} />
                  Terminar y Guardar
                </button>
              )}
            </div>
          </div>

          {/* Resumen Rápido Inferior */}
          {stats && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-line bg-panel p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
                    Tiempo Hoy
                  </span>
                  <Flame size={18} className="text-signal" />
                </div>
                <p className="mt-2 font-mono text-2xl font-bold text-ink">
                  {formatDurationHuman(stats.today_seconds)}
                </p>
                <p className="mt-1 text-xs text-ink-soft">
                  {stats.today_sessions_count} {stats.today_sessions_count === 1 ? "sesión" : "sesiones"} hoy
                </p>
              </div>

              <div className="rounded-2xl border border-line bg-panel p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
                    Últimos 7 Días
                  </span>
                  <Calendar size={18} className="text-mint" />
                </div>
                <p className="mt-2 font-mono text-2xl font-bold text-ink">
                  {formatDurationHuman(stats.week_seconds)}
                </p>
                <p className="mt-1 text-xs text-ink-soft">Enfoque acumulado</p>
              </div>

              <div className="rounded-2xl border border-line bg-panel p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
                    Total Histórico
                  </span>
                  <Sparkles size={18} className="text-violet" />
                </div>
                <p className="mt-2 font-mono text-2xl font-bold text-ink">
                  {formatDurationHuman(stats.total_seconds)}
                </p>
                <p className="mt-1 text-xs text-ink-soft">En todos tus hábitos</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── VISTA DE ESTADÍSTICAS & HISTORIAL ─── */}
      {activeTab === "history" && (
        <div className="mt-8 space-y-8">
          {/* Tarjetas Superiores */}
          {stats && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-line bg-panel p-5">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
                  Tiempo Hoy
                </span>
                <p className="mt-2 font-mono text-2xl font-bold text-ink">
                  {formatDurationHuman(stats.today_seconds)}
                </p>
                <p className="mt-1 text-xs text-ink-soft">
                  {stats.today_sessions_count} sesiones realizadas
                </p>
              </div>

              <div className="rounded-2xl border border-line bg-panel p-5">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
                  Esta Semana
                </span>
                <p className="mt-2 font-mono text-2xl font-bold text-ink">
                  {formatDurationHuman(stats.week_seconds)}
                </p>
                <p className="mt-1 text-xs text-ink-soft">Tiempo de enfoque</p>
              </div>

              <div className="rounded-2xl border border-line bg-panel p-5">
                <span className="text-xs font-semibold uppercase tracking-wider text-ink-faint">
                  Total Registrado
                </span>
                <p className="mt-2 font-mono text-2xl font-bold text-ink">
                  {formatDurationHuman(stats.total_seconds)}
                </p>
                <p className="mt-1 text-xs text-ink-soft">En la aplicación</p>
              </div>
            </div>
          )}

          {/* Desglose de Tiempo por Hábito */}
          <div className="rounded-2xl border border-line bg-panel p-6 shadow-sm">
            <h2 className="font-mono text-base font-bold text-ink">
              Distribución de Tiempo por Hábito
            </h2>
            <p className="mt-1 text-xs text-ink-soft">
              Cuánto tiempo total le has dedicado a cada hábito registrado.
            </p>

            {stats?.habits_breakdown?.length > 0 ? (
              <div className="mt-6 space-y-4">
                {stats.habits_breakdown.map((item) => {
                  const maxSeconds = stats.total_seconds || 1;
                  const percent = Math.round((item.total_seconds / maxSeconds) * 100);

                  return (
                    <div key={item.habit_id || "unassigned"} className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-medium">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-ink">{item.habit_name}</span>
                          <span className="rounded-md bg-panel-alt px-1.5 py-0.5 text-[10px] text-ink-faint">
                            {item.category}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-ink-faint text-[11px]">
                            {item.session_count} {item.session_count === 1 ? "sesión" : "sesiones"}
                          </span>
                          <span className="font-mono font-bold text-ink">
                            {formatDurationHuman(item.total_seconds)}
                          </span>
                        </div>
                      </div>

                      {/* Barra de progreso */}
                      <div className="h-2 w-full overflow-hidden rounded-full bg-panel-alt">
                        <div
                          className="h-full rounded-full bg-signal transition-all duration-500"
                          style={{ width: `${Math.max(5, percent)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-6 rounded-xl border border-dashed border-line p-8 text-center text-xs text-ink-faint">
                Aún no hay sesiones registradas. Inicia un temporizador para comenzar a acumular datos.
              </div>
            )}
          </div>

          {/* Historial Detallado de Sesiones */}
          <div className="rounded-2xl border border-line bg-panel p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-mono text-base font-bold text-ink">
                  Historial Reciente de Sesiones
                </h2>
                <p className="mt-1 text-xs text-ink-soft">
                  Registro cronológico de horas de inicio, término y duración por sesión.
                </p>
              </div>
            </div>

            {sessions.length > 0 ? (
              <div className="mt-6 divide-y divide-line overflow-hidden rounded-xl border border-line">
                {sessions.map((s) => (
                  <div
                    key={s.id}
                    className="flex flex-wrap items-center justify-between gap-4 bg-panel px-4 py-3.5 hover:bg-panel-alt/50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-ink truncate">
                          {s.habit?.name || "Sesión General"}
                        </span>
                        {s.habit?.category && (
                          <span className="rounded bg-panel-alt px-1.5 py-0.5 text-[10px] text-ink-soft">
                            {s.habit.category}
                          </span>
                        )}
                      </div>

                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-ink-soft">
                        <span className="flex items-center gap-1 font-mono text-[11px]">
                          <Calendar size={13} className="text-ink-faint" />
                          {formatDateLabel(s.start_time)}
                        </span>
                        <span className="flex items-center gap-1 font-mono text-[11px]">
                          <Clock size={13} className="text-ink-faint" />
                          {formatHour(s.start_time)} → {formatHour(s.end_time)}
                        </span>
                        {s.notes && (
                          <span className="text-ink-faint italic truncate max-w-xs">
                            "{s.notes}"
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-bold text-signal">
                        {formatDurationHuman(s.duration_seconds)}
                      </span>

                      <button
                        onClick={() => handleDeleteSession(s.id)}
                        title="Eliminar registro"
                        className="rounded-lg p-1.5 text-ink-faint hover:bg-coral-soft hover:text-coral transition-colors cursor-pointer"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-6 rounded-xl border border-dashed border-line p-8 text-center text-xs text-ink-faint">
                No hay sesiones en el historial todavía.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── MODAL GUARDAR SESIÓN COMPLETADA ─── */}
      {saveModalOpen && sessionToSave && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-line bg-panel p-6 shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3 text-mint">
              <CheckCircle2 size={28} />
              <div>
                <h3 className="font-mono text-lg font-bold text-ink">¡Sesión Finalizada!</h3>
                <p className="text-xs text-ink-soft">Tiempo de enfoque completado con éxito</p>
              </div>
            </div>

            {/* Resumen de tiempos */}
            <div className="mt-5 rounded-xl border border-line bg-panel-alt p-4 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-ink-soft">Hábito:</span>
                <span className="font-semibold text-ink">{sessionToSave.habit_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-soft">Hora de inicio:</span>
                <span className="font-mono text-ink">{formatHour(sessionToSave.start_time)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-soft">Hora de término:</span>
                <span className="font-mono text-ink">{formatHour(sessionToSave.end_time)}</span>
              </div>
              <div className="flex justify-between border-t border-line pt-2">
                <span className="font-medium text-ink">Tiempo dedicado:</span>
                <span className="font-mono font-bold text-signal text-sm">
                  {formatDurationHuman(sessionToSave.duration_seconds)}
                </span>
              </div>
            </div>

            {/* Checkbox auto-marcar como completado */}
            {sessionToSave.habit_id && (
              <label className="mt-4 flex items-start gap-2.5 text-xs text-ink cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoMarkDone}
                  onChange={(e) => setAutoMarkDone(e.target.checked)}
                  className="mt-0.5 rounded border-line text-signal focus:ring-signal"
                />
                <div>
                  <span className="font-semibold">Marcar como completado hoy</span>
                  <p className="text-ink-soft text-[11px]">
                    Registra automáticamente este hábito como hecho en tu lista del día.
                  </p>
                </div>
              </label>
            )}

            {/* Nota opcional */}
            <div className="mt-4">
              <label className="block text-xs font-semibold text-ink-soft mb-1">
                Nota opcional (¿Qué lograste o avanzaste?):
              </label>
              <textarea
                value={saveNotes}
                onChange={(e) => setSaveNotes(e.target.value)}
                placeholder="Ej. Leí hasta el capítulo 5, resolví el bug..."
                rows={2}
                maxLength={500}
                className="w-full rounded-xl border border-line bg-panel-alt p-2.5 text-xs text-ink placeholder:text-ink-faint focus:border-signal focus:outline-none"
              />
            </div>

            {/* Botones de acción */}
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => {
                  setSaveModalOpen(false);
                  setSessionToSave(null);
                  handleReset();
                }}
                disabled={isSaving}
                className="rounded-xl px-4 py-2.5 text-xs font-medium text-ink-soft hover:text-ink transition-colors cursor-pointer"
              >
                Descartar
              </button>
              <button
                onClick={handleSaveSession}
                disabled={isSaving}
                className="flex items-center gap-1.5 rounded-xl bg-signal px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:opacity-95 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSaving ? "Guardando..." : "Guardar Registro"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
