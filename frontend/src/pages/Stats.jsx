import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { useStats } from "../hooks/useStats";
import StatCard from "../components/StatCard";
import { categoryMeta } from "../lib/categories";

function tokenToHex(token, isDark) {
  // Resolve a CSS variable to a concrete color for recharts (which can't read var() reliably in <Cell>)
  const map = isDark
    ? {
        signal: "#F5A623",
        mint: "#34D399",
        coral: "#FB7185",
        violet: "#9B8CFA",
        sky: "#5EA3EA",
        "ink-faint": "#5A6479",
      }
    : {
        signal: "#C97A0E",
        mint: "#0F9D74",
        coral: "#D6455D",
        violet: "#6D5BD0",
        sky: "#2B77C9",
        "ink-faint": "#9AA2B6",
      };
  return map[token] || map.signal;
}

export default function Stats() {
  const { summary, weekly, byCategory, loading, error } = useStats();
  const isDark = document.documentElement.classList.contains("dark");

  const gridColor = isDark ? "#232E47" : "#E3E7F0";
  const textColor = isDark ? "#8B96AD" : "#5B6478";

  const weeklyData = weekly.map((d) => ({
    label: d.label,
    Completados: d.completed_count,
    Programados: d.total_count,
  }));

  const categoryData = byCategory.map((c) => ({
    name: categoryMeta(c.category).label,
    value: c.completed_count,
    token: categoryMeta(c.category).token,
  }));

  if (loading) return <p className="text-sm text-ink-soft">Cargando estadísticas…</p>;
  if (error)
    return <p className="rounded-lg bg-coral-soft px-4 py-3 text-sm text-coral">{error}</p>;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Estadísticas</h1>
        <p className="text-sm text-ink-soft">Tu consistencia a lo largo del tiempo.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Racha actual" value={summary.current_streak} sublabel="días" accent="mint" />
        <StatCard label="Mejor racha" value={summary.best_streak} sublabel="días" accent="signal" />
        <StatCard label="Semana" value={`${summary.week_completion_rate}%`} sublabel="cumplimiento" accent="violet" />
        <StatCard label="Total completados" value={summary.total_completed} sublabel="hábitos" accent="sky" />
      </div>

      <div className="rounded-2xl border border-line bg-panel p-4 md:p-6">
        <h2 className="mb-4 text-sm font-semibold text-ink-soft">
          Últimos 7 días
        </h2>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyData} barGap={4}>
              <CartesianGrid vertical={false} stroke={gridColor} />
              <XAxis
                dataKey="label"
                tick={{ fill: textColor, fontSize: 12, fontFamily: "IBM Plex Mono" }}
                axisLine={{ stroke: gridColor }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: textColor, fontSize: 12, fontFamily: "IBM Plex Mono" }}
                axisLine={false}
                tickLine={false}
                width={24}
              />
              <Tooltip
                contentStyle={{
                  background: isDark ? "#131B2E" : "#FFFFFF",
                  border: `1px solid ${gridColor}`,
                  borderRadius: 10,
                  fontSize: 13,
                }}
              />
              <Bar dataKey="Programados" fill={gridColor} radius={[4, 4, 4, 4]} />
              <Bar dataKey="Completados" fill={tokenToHex("signal", isDark)} radius={[4, 4, 4, 4]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-panel p-4 md:p-6">
        <h2 className="mb-4 text-sm font-semibold text-ink-soft">
          Cumplimiento por categoría
        </h2>
        {categoryData.length === 0 ? (
          <p className="text-sm text-ink-faint">
            Aún no hay hábitos completados para mostrar aquí.
          </p>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                >
                  {categoryData.map((entry, i) => (
                    <Cell key={i} fill={tokenToHex(entry.token, isDark)} stroke="none" />
                  ))}
                </Pie>
                <Legend
                  verticalAlign="middle"
                  align="right"
                  layout="vertical"
                  iconType="circle"
                  wrapperStyle={{ fontSize: 13, color: textColor }}
                />
                <Tooltip
                  contentStyle={{
                    background: isDark ? "#131B2E" : "#FFFFFF",
                    border: `1px solid ${gridColor}`,
                    borderRadius: 10,
                    fontSize: 13,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
