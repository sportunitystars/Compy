self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "Compy", body: event.data.text() };
  }

  const isStreakAlert = payload.sound === true || (payload.tag && payload.tag.startsWith("streak-"));

  const notificationOptions = {
    body: payload.body ?? "",
    icon: "/icon-transparent.png",
    badge: "/notification-badge.png",
    tag: payload.tag ?? "compy-push",
    renotify: true,
    data: { sound: isStreakAlert },
  };

  if (isStreakAlert) {
    notificationOptions.sound = "/streak-notification.mp3";
  }

  event.waitUntil(
    self.registration.showNotification(payload.title ?? "Compy", notificationOptions).then(() => {
      if (isStreakAlert) {
        return self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
          clientList.forEach((client) => {
            client.postMessage({ type: "PLAY_STREAK_SOUND" });
          });
        });
      }
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
