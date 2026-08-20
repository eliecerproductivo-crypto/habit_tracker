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

/**
 * Checks if the Notification API is available and permission is granted.
 */
function canNotify() {
  return "Notification" in window && Notification.permission === "granted";
}

/**
 * Fires a browser notification for a habit.
 */
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
  // Track which habit+day combos have already been notified to avoid repeats
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
    // Reset fired notifications so the new timing takes effect today
    notifiedRef.current.clear();
  }, []);

  useEffect(() => {
    if (!canNotify() || !habits?.length) return;

    const check = () => {
      const now = new Date();
      const day = now.getDay();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const todayKey = now.toDateString();

      habits.forEach((habit) => {
        if (habit.is_active === false) return;
        if (!parseDays(habit.days_of_week).includes(day)) return;

        const start = toMinutes(habit.start_time);
        if (start == null) return;

        const minutesLeft = start - nowMinutes;
        const key = `${habit.id}-${todayKey}-${advanceMinutes}`;

        // Fire when we're within the advance window (±1 min tolerance)
        if (minutesLeft > 0 && minutesLeft <= advanceMinutes && !notifiedRef.current.has(key)) {
          notifiedRef.current.add(key);
          fireNotification(habit, minutesLeft);
        }
      });
    };

    check(); // run immediately in case we're already in the window
    const id = setInterval(check, 60_000); // then every minute
    return () => clearInterval(id);
  }, [habits, advanceMinutes]);

  return { permission, advanceMinutes, requestPermission, setAdvanceMinutes };
}
