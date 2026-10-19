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
 * Handles all four recurrence types: weekly, interval, monthly, weekly_times.
 *
 * For weekly_times: the habit appears every day of the week until the user has
 * logged it recurrence_times_per_week times in that week (Mon–Sun).
 * `completedDatesInWeek` is an optional Set<string> of ISO dates already marked
 * "done" for this habit in the same week — used to hide the habit once the
 * weekly quota is reached. Pass undefined/null to show it unconditionally (e.g.
 * in the heatmap or when building the schedule without log context).
 */
export function habitOccursOnDate(habit, isoDate, completedDatesInWeek = null) {
  const type = habit.recurrence_type || "weekly";

  if (type === "weekly") {
    const weekday = weekdayOfISODate(isoDate);
    const days = parseDays(habit.days_of_week ?? "0,1,2,3,4,5,6");
    return days.includes(weekday);
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

  if (type === "weekly_times") {
    const target = habit.recurrence_times_per_week ?? 1;
    // If caller provided the set of already-completed dates for this week,
    // hide the habit once the quota is reached (and this day isn't already one
    // of the completed ones — keep it visible so the user can undo it).
    if (completedDatesInWeek !== null) {
      const alreadyDoneThisDay = completedDatesInWeek.has(isoDate);
      const doneCount = completedDatesInWeek.size;
      if (!alreadyDoneThisDay && doneCount >= target) return false;
    }
    return true; // show on every day of the week
  }

  return false;
}

/**
 * Like habitOccursOnDate but without log context — always returns true for
 * weekly_times (used for heatmap / stats where we want to show all days).
 */
export function habitOccursOnDateRaw(habit, isoDate) {
  return habitOccursOnDate(habit, isoDate, null);
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

/**
 * Returns the ISO date of the Monday of the week containing isoDate.
 * Week starts on Monday (ISO convention).
 */
export function weekMondayOf(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  // getDay(): 0=Sun,1=Mon,...,6=Sat  →  shift so Mon=0
  const dow = (dt.getDay() + 6) % 7;
  dt.setDate(dt.getDate() - dow);
  return [
    dt.getFullYear(),
    String(dt.getMonth() + 1).padStart(2, "0"),
    String(dt.getDate()).padStart(2, "0"),
  ].join("-");
}

/**
 * Returns all 7 ISO dates (Mon–Sun) of the week containing isoDate.
 */
export function weekDatesOf(isoDate) {
  const monday = weekMondayOf(isoDate);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/**
 * Evaluates whether a habit can use a wildcard rest today according to business rules:
 * 1. Global quota remaining > 0
 * 2. Habit formation period >= 14 days
 * 3. Not used consecutively (cannot have rested yesterday)
 * 4. Not already completed (done/skipped) today
 */
export function getHabitRestEligibility(
  habit,
  habitWildcard,
  logsByHabitId,
  weekLogsByHabitId,
  todayStr = todayLocalISODate()
) {
  if (!habit) return { canRest: false, reason: null, isActive: false };
  const currentStatus = logsByHabitId?.[habit.id]?.status;
  if (currentStatus === "rest") {
    return { canRest: true, reason: null, isActive: true };
  }
  if (!habitWildcard || habitWildcard.quota_remaining <= 0) {
    return { canRest: false, reason: "Agotaste tus descansos de esta quincena", isActive: false };
  }
  if (currentStatus === "done" || currentStatus === "skipped") {
    return { canRest: false, reason: "Ya registraste este hábito hoy", isActive: false };
  }

  // Regla de formación: mínimo 14 días desde created_at
  if (habit.created_at) {
    const raw = habit.created_at;
    const hasZone = raw.endsWith("Z") || /[+-]\d{2}:\d{2}$/.test(raw);
    const createdDate = new Date(hasZone ? raw : raw + "Z");
    if (!isNaN(createdDate.getTime())) {
      const [y, m, d] = todayStr.split("-").map(Number);
      const todayDate = new Date(y, m - 1, d);
      const createdMidnight = new Date(createdDate.getFullYear(), createdDate.getMonth(), createdDate.getDate());
      const diffDays = Math.floor((todayDate - createdMidnight) / (1000 * 60 * 60 * 24));
      if (diffDays < 14) {
        const daysLeft = 14 - diffDays;
        return {
          canRest: false,
          reason: `Este hábito aún está en formación (${daysLeft} ${daysLeft === 1 ? "día restante" : "días restantes"})`,
          isActive: false,
        };
      }
    }
  }

  // Regla anti-consecutivo: no puede haber descansado ayer
  const yesterday = addDays(todayStr, -1);
  if (weekLogsByHabitId?.[habit.id]?.[yesterday]?.status === "rest") {
    return { canRest: false, reason: "Este hábito ya descansó ayer", isActive: false };
  }

  return { canRest: true, reason: null, isActive: false };
}
