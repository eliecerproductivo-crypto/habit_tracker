// Service Worker mínimo para notificaciones en móvil
self.addEventListener("push", () => {});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(clients.openWindow("/"));
});
