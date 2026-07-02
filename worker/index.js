// Custom service worker code injected by next-pwa via customWorkerDir

// Push notification listener
self.addEventListener("push", (event) => {
  if (!event.data) return

  let data
  try {
    data = event.data.json()
  } catch (e) {
    data = { title: "Regalo de Dios", body: event.data.text() }
  }

  const title = data.title || "Regalo de Dios"
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    vibrate: [200, 100, 200],
    data: {
      url: data.url || "/dashboard",
    },
    actions: data.actions || [],
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// Click en la notificación: abrir la app
self.addEventListener("notificationclick", (event) => {
  event.notification.close()

  const url = event.notification.data?.url || "/dashboard"

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Si ya hay una ventana abierta, enfocarla
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      // Si no, abrir una nueva
      return self.clients.openWindow(url)
    })
  )
})
