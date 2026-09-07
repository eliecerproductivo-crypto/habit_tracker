export default function StatCard({ label, value, sublabel, accent = "signal" }) {
  return (
    <div className="rounded-2xl border border-line bg-panel px-2.5 py-3 md:px-4 md:py-4">
      <p className="truncate text-[10px] font-medium uppercase tracking-wide text-ink-faint md:text-xs">
        {label}
      </p>
      <p
        className="mt-1 font-mono text-xl font-semibold tabular md:text-2xl"
        style={{ color: `var(--${accent})` }}
      >
        {value}
      </p>
      {sublabel && <p className="mt-0.5 truncate text-[10px] text-ink-soft md:text-xs">{sublabel}</p>}
    </div>
  );
}
