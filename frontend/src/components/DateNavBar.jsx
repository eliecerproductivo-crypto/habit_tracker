import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import {
  addDays,
  formatDateLabel,
  todayLocalISODate,
  toLocalISODate,
  DAY_LABELS,
} from "../lib/schedule";
import { useAuth } from "../context/AuthContext";

const MONTH_LABELS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function parseISO(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function buildMonthGrid(year, month) {
  const startWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function DateNavBar({ date, onChange }) {
  const { user } = useAuth();
  const isToday = date === todayLocalISODate();
  const label = formatDateLabel(date);

  const minDate = user?.created_at ? user.created_at.slice(0, 10) : todayLocalISODate();
  const canGoPrev = date > minDate;

  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => parseISO(date).getFullYear());
  const [viewMonth, setViewMonth] = useState(() => parseISO(date).getMonth());

  const buttonRef = useRef(null);
  const popoverRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const dt = parseISO(date);
    setViewYear(dt.getFullYear());
    setViewMonth(dt.getMonth());
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (
        popoverRef.current && !popoverRef.current.contains(e.target) &&
        buttonRef.current && !buttonRef.current.contains(e.target)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const goPrevMonth = () => {
    if (viewMonth === 0) { setViewYear((y) => y - 1); setViewMonth(11); }
    else setViewMonth((m) => m - 1);
  };

  const goNextMonth = () => {
    if (viewMonth === 11) { setViewYear((y) => y + 1); setViewMonth(0); }
    else setViewMonth((m) => m + 1);
  };

  const handlePick = (day) => {
    if (day == null) return;
    const iso = toLocalISODate(new Date(viewYear, viewMonth, day));
    if (iso < minDate) return;
    onChange(iso);
    setOpen(false);
  };

  const cells = buildMonthGrid(viewYear, viewMonth);
  const today = todayLocalISODate();

  return (
    <div className="relative flex items-center justify-between gap-2 rounded-2xl border border-line bg-panel px-3 py-2">
      <button
        onClick={() => canGoPrev && onChange(addDays(date, -1))}
        disabled={!canGoPrev}
        aria-label="Día anterior"
        className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-panel-alt hover:text-ink cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
      >
        <ChevronLeft size={18} />
      </button>

      <div className="flex flex-col items-center">
        <button
          ref={buttonRef}
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium capitalize text-ink transition-colors hover:bg-panel-alt cursor-pointer"
        >
          <Calendar size={13} className="text-ink-faint" />
          {label}
        </button>
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

      {open && (
        <div
          ref={popoverRef}
          className="absolute left-1/2 top-full z-20 mt-2 w-72 -translate-x-1/2 rounded-2xl border border-line bg-panel p-3 shadow-[var(--shadow-card)]"
        >
          <div className="mb-2 flex items-center justify-between">
            <button
              onClick={goPrevMonth}
              aria-label="Mes anterior"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-panel-alt hover:text-ink cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>
            <p className="text-sm font-semibold capitalize">
              {MONTH_LABELS[viewMonth]} {viewYear}
            </p>
            <button
              onClick={goNextMonth}
              aria-label="Mes siguiente"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-faint transition-colors hover:bg-panel-alt hover:text-ink cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {DAY_LABELS.map((l) => (
              <span
                key={l}
                className="flex h-7 items-center justify-center text-[10px] font-semibold uppercase text-ink-faint"
              >
                {l[0]}
              </span>
            ))}

            {cells.map((day, i) => {
              if (day == null) return <span key={i} />;
              const iso = toLocalISODate(new Date(viewYear, viewMonth, day));
              const isSelected = iso === date;
              const isTodayCell = iso === today;
              const isDisabled = iso < minDate;

              return (
                <button
                  key={i}
                  onClick={() => handlePick(day)}
                  disabled={isDisabled}
                  className={[
                    "flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium transition-colors cursor-pointer",
                    isSelected
                      ? "bg-signal font-semibold text-panel"
                      : isTodayCell
                      ? "border border-signal text-signal"
                      : "text-ink-soft hover:bg-panel-alt hover:text-ink",
                    isDisabled && "cursor-not-allowed opacity-30 hover:bg-transparent",
                  ].filter(Boolean).join(" ")}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
