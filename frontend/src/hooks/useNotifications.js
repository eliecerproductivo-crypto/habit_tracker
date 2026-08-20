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

// Register SW once and cache the registration promise
let swRegistrationPromise = null;

function getSwRegistration() {
  if (!("serviceWorker" in navigator)) return Promise.resolve(null);
  if (!swRegistrationPromise) {
    swRegistrationPromise = navigator.serviceWorker
      .register("/sw.js")
      .catch((err) => {
        console.warn("SW registration failed:", err);
        return null;
      });
  }
  return swRegistrationPromise;
}

async function fireNotification(habit, minutesLeft) {
  if (!canNotify()) return;

  const title = `⏰ ${habit.name}`;
  const body =
    minutesLeft <= 1
      ? "¡Empieza ahora!"
      : `Comienza en ${minutesLeft} minuto${minutesLeft !== 1 ? "s" : ""}`;
  const options = { body, icon: "/favicon.svg", badge: "/favicon.svg" };

  try {
    const reg = await getSwRegistration();
    if (reg) {
      // Mobile path — required on Android Chrome
      await reg.showNotification(title, options);
    } else {
      // Desktop fallback
      new Notification(title, options);
    }
  } catch (err) {
    // Last resort fallback for desktop browsers without SW
    try {
      new Notification(title, options);
    } catch {
      console.warn("Notification failed:", err);
    }
  }
}

export function useNotifications(habits) {
  const [permission, setPermission] = useState(
    "Notification" in window ? Notification.permission : "unsupported"
  );
  const [advanceMinutes, setAdvanceMinutesState] = useState(getAdvanceMinutes);
  const notifiedRef = useRef(new Set());

  const requestPermission = useCallback(async () => {
    if (!("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
    // Pre-register SW as soon as permission is granted
    if (result === "granted") getSwRegistration();
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
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const dateKey = now.toISOString().slice(0, 10);

      habits.forEach((habit) => {
        if (habit.is_active === false) return;
        if (!parseDays(habit.days_of_week).includes(day)) return;

        const start = toMinutes(habit.start_time);
        if (start == null) return;

        const minutesLeft = start - nowMinutes;
        if (minutesLeft >= 0 && minutesLeft <= advanceMinutes) {
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
