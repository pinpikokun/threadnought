// Threadnought Web Push サービスワーカー。
// push イベントで通知を表示し、クリックで該当チケットを開く。

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = {};
  }
  const title = data.title || "Threadnought";
  const options = {
    body: data.body || "",
    data: { url: data.url || "/" },
    tag: data.url || "threadnought",
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.indexOf(url) !== -1 && "focus" in w) return w.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});
