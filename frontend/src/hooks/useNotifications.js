import { useCallback, useEffect, useRef, useState } from "react";
import { parseDays, toMinutes } from "../lib/schedule";

const STORAGE_KEY = "rutina_notif_minutes";
const DEFAULT_MINUTES = 15;

function getAdvanceMinutes() {
  const stored = localStorage.getItem(STORAGE_KEY);
  const parsed = parseInt(stored, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MINUTES;
}

function saveAdvanceMinutes(m) {
  localStorage.setItem(STORAGE_KEY, String(m));
}

function canNotify() {
  return "Notification" in window && Notification.permission === "granted";
}

function fireNotification(habit, minutesLeft) {
  if (!canNotify()) return;
  const body =
    minutesLeft <= 1
      ? "¡Empieza ahora!"
      : `Comienza en ${minutesLeft} minuto${minutesLeft !== 1 ? "s" : ""}`;
  new Notification(`⏰ ${habit.name}`, { body, icon: "/favicon.svg" });
}

export function useNotifications(habits) {
  const [permission, setPermission] = useState(
    "Notification" in window ? Notification.permission : "unsupported"
  );
  const [advanceMinutes, setAdvanceMinutesState] = useState(getAdvanceMinutes);
  // Key: "habitId-YYYY-MM-DD-startTime" — unique per habit per day per start time
  const notifiedRef = useRef(new Set());

  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
  }, []);

  const setAdvanceMinutes = useCallback((m) => {
    const value = Math.max(1, Math.min(120, Number(m)));
    saveAdvanceMinutes(value);
    setAdvanceMinutesState(value);
    notifiedRef.current.clear();
  }, []);

  useEffect(() => {
    if (!canNotify() || !habits?.length) return;

    const check = () => {
      const now = new Date();
      const day = now.getDay();
      // Use total minutes from midnight for comparison
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      // Date string for daily reset of notifications
      const dateKey = now.toISOString().slice(0, 10);

      habits.forEach((habit) => {
        if (habit.is_active === false) return;
        if (!parseDays(habit.days_of_week).includes(day)) return;

        const start = toMinutes(habit.start_time);
        if (start == null) return;

        const minutesLeft = start - nowMinutes;

        // Fire when inside the notification window.
        // Window: from advanceMinutes down to 0 (we allow up to advanceMinutes+1
        // so a 60s tick never misses the window).
        if (minutesLeft >= 0 && minutesLeft <= advanceMinutes) {
          // Key includes start_time so each habit fires once per day regardless
          // of how many habits share the same day.
          const key = `${habit.id}-${dateKey}-${habit.start_time}`;
          if (!notifiedRef.current.has(key)) {
            notifiedRef.current.add(key);
            fireNotification(habit, minutesLeft);
          }
        }
      });
    };

    check();
    const id = setInterval(check, 60_000);

    // Also re-check when the tab becomes visible again (mobile browser wakeup)
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [habits, advanceMinutes]);

  return { permission, advanceMinutes, requestPermission, setAdvanceMinutes };
}
