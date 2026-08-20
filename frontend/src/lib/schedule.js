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

export function habitStatusNow(habit, now = new Date()) {
  const day = now.getDay();
  const days = parseDays(habit.days_of_week);
  if (!days.includes(day)) return "not-scheduled";

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
