/**
 * Custom Service Worker additions for Push Notifications.
 * next-pwa merges this with the generated sw.js via customWorkerDir.
 */

// Handle incoming push notifications
self.addEventListener("push", (event) => {
  if (!event.data) return

  let data
  try {
    data = event.data.json()
  } catch {
    data = { title: "Notificación", body: event.data.text() }
  }

  const title = data.title || "Regalo de Dios"
  const options = {
    body: data.body || "",
    icon: "/logo.png",
    badge: "/icon-192.png",
    data: {
      url: data.url || "/dashboard",
    },
    vibrate: [200, 100, 200],
    tag: data.tag || "default",
    renotify: !!data.tag,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

// Handle notification click - open or focus the app
self.addEventListener("notificationclick", (event) => {
  event.notification.close()

  const targetUrl = event.notification.data?.url || "/dashboard"

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // If there's already a window open, focus it and navigate
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.focus()
          client.navigate(targetUrl)
          return
        }
      }
      // Otherwise open a new window
      return clients.openWindow(targetUrl)
    })
  )
})
