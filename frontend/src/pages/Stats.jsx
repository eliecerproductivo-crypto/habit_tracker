import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, PieChart, Pie, Cell, Legend,
} from "recharts";
import { BarChart3, ListChecks, ChevronRight, Flame, Trophy, CheckCircle2, Calendar } from "lucide-react";
import { useStats } from "../hooks/useStats";
import { useHabits } from "../hooks/useHabits";
import { useWildcard } from "../hooks/useWildcard";
import StatCard from "../components/StatCard";
import WildcardWidget from "../components/WildcardWidget";
import HabitStatsModal from "../components/HabitStatsModal";
import { categoryMeta } from "../lib/categories";

function tokenToHex(token, isDark) {
  const map = isDark
    ? { signal: "#F5A623", mint: "#34D399", coral: "#FB7185", violet: "#9B8CFA", sky: "#5EA3EA", "ink-faint": "#5A6479" }
    : { signal: "#C97A0E", mint: "#0F9D74", coral: "#D6455D", violet: "#6D5BD0", sky: "#2B77C9", "ink-faint": "#9AA2B6" };
  return map[token] || map.signal;
}

// ── Pestaña: General ─────────────────────────────────────────────────────────
function TabGeneral({ summary, weekly, byCategory, wildcard, gained, useWildcardForDate, isDark }) {
  const gridColor  = isDark ? "#232E47" : "#E3E7F0";
  const textColor  = isDark ? "#8B96AD" : "#5B6478";

  const weeklyData   = weekly.map((d) => ({
    label: d.label,
    Completados: d.completed_count,
    Programados: d.total_count,
  }));
  const categoryData = byCategory.map((c) => ({
    name:  categoryMeta(c.category).label,
    value: c.completed_count,
    token: categoryMeta(c.category).token,
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Racha actual"     value={summary.current_streak}            sublabel="días"       accent="mint"   />
        <StatCard label="Mejor racha"      value={summary.best_streak}               sublabel="días"       accent="signal" />
        <StatCard label="Semana"           value={`${summary.week_completion_rate}%`} sublabel="cumplimiento" accent="violet" />
        <StatCard label="Total completados" value={summary.total_completed}           sublabel="hábitos"    accent="sky"    />
      </div>

      <WildcardWidget
        wildcard={wildcard}
        currentStreak={summary.current_streak}
        gained={gained}
        onUse={useWildcardForDate}
      />

      {/* Últimos 7 días */}
      <div className="rounded-2xl border border-line bg-panel p-4 md:p-6">
        <h2 className="mb-4 text-sm font-semibold text-ink-soft">Últimos 7 días</h2>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyData} barGap={4}>
              <CartesianGrid vertical={false} stroke={gridColor} />
              <XAxis dataKey="label" tick={{ fill: textColor, fontSize: 12, fontFamily: "IBM Plex Mono" }} axisLine={{ stroke: gridColor }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: textColor, fontSize: 12, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} width={24} />
              <Tooltip contentStyle={{ background: isDark ? "#131B2E" : "#FFFFFF", border: `1px solid ${gridColor}`, borderRadius: 10, fontSize: 13 }} />
              <Bar dataKey="Programados" fill={gridColor}                          radius={[4,4,4,4]} />
              <Bar dataKey="Completados" fill={tokenToHex("signal", isDark)}       radius={[4,4,4,4]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Por categoría */}
      <div className="rounded-2xl border border-line bg-panel p-4 md:p-6">
        <h2 className="mb-4 text-sm font-semibold text-ink-soft">Cumplimiento por categoría</h2>
        {categoryData.length === 0 ? (
          <p className="text-sm text-ink-faint">Aún no hay hábitos completados para mostrar aquí.</p>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={categoryData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={3}>
                  {categoryData.map((entry, i) => (
                    <Cell key={i} fill={tokenToHex(entry.token, isDark)} stroke="none" />
                  ))}
                </Pie>
                <Legend verticalAlign="middle" align="right" layout="vertical" iconType="circle" wrapperStyle={{ fontSize: 13, color: textColor }} />
                <Tooltip contentStyle={{ background: isDark ? "#131B2E" : "#FFFFFF", border: `1px solid ${gridColor}`, borderRadius: 10, fontSize: 13 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Pestaña: Por hábito ───────────────────────────────────────────────────────
function TabHabitos({ onSelect }) {
  const { habits, loading } = useHabits();
  const active = habits.filter((h) => h.is_active);

  if (loading) return <p className="text-sm text-ink-soft">Cargando hábitos…</p>;
  if (active.length === 0) return (
    <div className="rounded-2xl border border-dashed border-line px-5 py-14 text-center">
      <p className="text-sm text-ink-soft">Aún no tienes hábitos activos.</p>
    </div>
  );

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-ink-faint mb-1">
        Toca un hábito para ver su historial detallado y estadísticas.
      </p>
      {active.map((habit) => {
        const meta = categoryMeta(habit.category);
        const Icon = meta.icon;
        return (
          <button
            key={habit.id}
            onClick={() => onSelect(habit)}
            className="flex w-full items-center gap-3 rounded-2xl border border-line bg-panel p-4 text-left transition-colors hover:bg-panel-alt cursor-pointer group"
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: `var(--${meta.token}-soft)`, color: `var(--${meta.token})` }}
            >
              <Icon size={17} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-ink">{habit.name}</p>
              <p className="text-xs text-ink-soft">{meta.label}</p>
            </div>
            <ChevronRight size={16} className="shrink-0 text-ink-faint group-hover:text-ink transition-colors" />
          </button>
        );
      })}
    </div>
  );
}

// ── Página principal ──────────────────────────────────────────────────────────
export default function Stats() {
  const { summary, weekly, byCategory, loading, error } = useStats();
  const { wildcard, gained, useWildcardForDate }        = useWildcard();
  const [tab, setTab]           = useState("general");   // "general" | "habitos"
  const [selectedHabit, setSelectedHabit] = useState(null);
  const isDark = document.documentElement.classList.contains("dark");

  if (loading) return <p className="text-sm text-ink-soft">Cargando estadísticas…</p>;
  if (error)   return <p className="rounded-lg bg-coral-soft px-4 py-3 text-sm text-coral">{error}</p>;

  return (
    <div className="flex flex-col gap-6">
      {/* Encabezado */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Estadísticas</h1>
          <p className="text-sm text-ink-soft">Tu consistencia a lo largo del tiempo.</p>
        </div>

        {/* Selector de pestañas */}
        <div className="flex items-center gap-1 rounded-xl bg-panel-alt p-1 border border-line">
          <button
            onClick={() => setTab("general")}
            className={[
              "flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer",
              tab === "general" ? "bg-panel text-signal shadow-sm" : "text-ink-soft hover:text-ink",
            ].join(" ")}
          >
            <BarChart3 size={14} />
            General
          </button>
          <button
            onClick={() => setTab("habitos")}
            className={[
              "flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer",
              tab === "habitos" ? "bg-panel text-signal shadow-sm" : "text-ink-soft hover:text-ink",
            ].join(" ")}
          >
            <ListChecks size={14} />
            Por hábito
          </button>
        </div>
      </div>

      {/* Contenido de la pestaña activa */}
      {tab === "general" ? (
        <TabGeneral
          summary={summary}
          weekly={weekly}
          byCategory={byCategory}
          wildcard={wildcard}
          gained={gained}
          useWildcardForDate={useWildcardForDate}
          isDark={isDark}
        />
      ) : (
        <TabHabitos onSelect={setSelectedHabit} />
      )}

      {/* Modal de detalle por hábito */}
      {selectedHabit && (
        <HabitStatsModal
          habit={selectedHabit}
          onClose={() => setSelectedHabit(null)}
        />
      )}
    </div>
  );
}
