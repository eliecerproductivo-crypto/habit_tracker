// Este archivo es el SW de desarrollo/fallback para notificaciones push.
// En producción, vite-plugin-pwa (Workbox) lo reemplaza con el SW generado
// que incluye precaché de assets, NetworkFirst para /api, y este código.

self.addEventListener("push", () => {});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(clients.openWindow("/"));
});
