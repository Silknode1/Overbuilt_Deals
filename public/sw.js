// Overbuilt service worker: shows deal alerts and opens the deal on tap.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { d = { title: "Overbuilt", body: event.data?.text() }; }
  // iOS revokes permission if a push arrives without a visible notification, so always show one.
  event.waitUntil(self.registration.showNotification(d.title || "Overbuilt deal", {
    body: d.body || "A deal you'd like hit a genuine low.",
    icon: "/icon-192.png", badge: "/icon-192.png", tag: d.id || "overbuilt", data: { url: d.url || "/" },
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(self.clients.openWindow(url));
});
