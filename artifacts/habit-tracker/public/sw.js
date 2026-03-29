self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Compy", body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? "Compy", {
      body: payload.body ?? "",
      icon: "/icon-transparent.png",
      badge: "/notification-badge.png",
      tag: payload.tag ?? "compy-push",
      renotify: true,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow("/");
    })
  );
});
