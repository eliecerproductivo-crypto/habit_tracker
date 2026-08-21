// Day-of-week convention matches JS Date#getDay(): 0 = domingo ... 6 = sábado
export const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
export const DAY_LABELS_FULL = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

export function parseDays(daysOfWeek) {
  if (!daysOfWeek) return [];
  return daysOfWeek
    .split(",")
    .map((d) => d.trim())
    .filter((d) => d.length > 0)
    .map(Number);
}

export function toMinutes(hhmm) {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function formatTime(hhmm) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "p. m." : "a. m.";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

export function formatDuration(startMinutes, endMinutes) {
  let diff = endMinutes - startMinutes;
  if (diff < 0) diff += 24 * 60;
  const h = Math.floor(diff / 60);
  const m = diff % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}

/**
 * Returns true if a habit is scheduled to occur on a given ISO date string.
 * Handles all three recurrence types: weekly, interval, monthly.
 */
export function habitOccursOnDate(habit, isoDate) {
  const type = habit.recurrence_type || "weekly";

  if (type === "weekly") {
    const weekday = weekdayOfISODate(isoDate);
    return parseDays(habit.days_of_week).includes(weekday);
  }

  if (type === "interval") {
    const interval = habit.recurrence_interval;
    if (!interval || interval < 1) return false;
    // Need a reference date — use start_date if set, otherwise created_at date
    const refRaw = habit.start_date || (habit.created_at ? habit.created_at.slice(0, 10) : null);
    if (!refRaw) return false;
    const ref = refRaw.slice(0, 10);
    const [ry, rm, rd] = ref.split("-").map(Number);
    const [ty, tm, td] = isoDate.split("-").map(Number);
    const refMs = new Date(ry, rm - 1, rd).getTime();
    const targetMs = new Date(ty, tm - 1, td).getTime();
    const diffDays = Math.round((targetMs - refMs) / 86400000);
    return diffDays >= 0 && diffDays % interval === 0;
  }

  if (type === "monthly") {
    const dom = habit.recurrence_day_of_month;
    if (dom == null) return false;
    const [y, m, d] = isoDate.split("-").map(Number);
    if (dom === -1) {
      // last day of month
      const lastDay = new Date(y, m, 0).getDate();
      return d === lastDay;
    }
    return d === dom;
  }

  return false;
}

export function habitStatusNow(habit, now = new Date()) {
  const isoDate = toLocalISODate(now);
  if (!habitOccursOnDate(habit, isoDate)) return "not-scheduled";

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const start = toMinutes(habit.start_time);
  const end = toMinutes(habit.end_time);
  if (start == null || end == null) return "not-scheduled";

  if (end > start) {
    if (nowMinutes >= start && nowMinutes < end) return "active";
    if (nowMinutes < start) return "upcoming";
    return "past";
  }
  if (nowMinutes >= start || nowMinutes < end) return "active";
  if (nowMinutes < start) return "upcoming";
  return "past";
}

export function getCurrentAndNext(habits, now = new Date()) {
  const scheduled = habits.filter((h) => h.is_active !== false);
  const active = scheduled.filter((h) => habitStatusNow(h, now) === "active");

  active.sort((a, b) => toMinutes(b.start_time) - toMinutes(a.start_time));

  const upcoming = scheduled
    .filter((h) => habitStatusNow(h, now) === "upcoming")
    .sort((a, b) => toMinutes(a.start_time) - toMinutes(b.start_time));

  return {
    current: active[0] || null,
    next: upcoming[0] || null,
  };
}

export function toLocalISODate(d) {
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

export function todayLocalISODate() {
  return toLocalISODate(new Date());
}

export function addDays(isoDate, delta) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return toLocalISODate(dt);
}

export function weekdayOfISODate(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

export function formatDateLabel(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString("es", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
