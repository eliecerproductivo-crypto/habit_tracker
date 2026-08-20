import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, formatDateLabel, todayLocalISODate } from "../lib/schedule";

export default function DateNavBar({ date, onChange }) {
  const isToday = date === todayLocalISODate();
  const label = formatDateLabel(date);

  return (
    <div className="flex items-center justify-between gap-2 rounded-2xl border border-line bg-panel px-3 py-2">
      <button
        onClick={() => onChange(addDays(date, -1))}
        aria-label="Día anterior"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-panel-alt hover:text-ink cursor-pointer"
      >
        <ChevronLeft size={18} />
      </button>

      <div className="flex flex-col items-center">
        <p className="text-sm font-medium capitalize text-ink">{label}</p>
        {!isToday && (
          <button
            onClick={() => onChange(todayLocalISODate())}
            className="mt-0.5 text-xs font-medium text-signal hover:underline cursor-pointer"
          >
            Volver a hoy
          </button>
        )}
      </div>

      <button
        onClick={() => onChange(addDays(date, 1))}
        aria-label="Día siguiente"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-panel-alt hover:text-ink cursor-pointer"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
