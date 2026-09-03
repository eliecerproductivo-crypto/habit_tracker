// Service Worker de Rutina
// Combina:
//   1. Precaché de assets estáticos (inyectado por vite-plugin-pwa en build)
//   2. Notificaciones push (lógica original)

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

// Precaché de todos los assets del build (Vite inyecta __WB_MANIFEST)
precacheAndRoute(self.__WB_MANIFEST || []);
cleanupOutdatedCaches();

// ── Notificaciones push (funcionalidad original) ──────────────────────────────
self.addEventListener('push', () => {});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(clients.openWindow('/'));
});
