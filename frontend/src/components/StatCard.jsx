export default function StatCard({ label, value, sublabel, accent = "signal" }) {
  return (
    <div className="rounded-2xl border border-line bg-panel px-4 py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">
        {label}
      </p>
      <p
        className="mt-1.5 font-mono text-2xl font-semibold tabular"
        style={{ color: `var(--${accent})` }}
      >
        {value}
      </p>
      {sublabel && <p className="mt-0.5 text-xs text-ink-soft">{sublabel}</p>}
    </div>
  );
}
