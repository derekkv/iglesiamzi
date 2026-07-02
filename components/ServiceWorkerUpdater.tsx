"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export function ServiceWorkerUpdater() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.ready.then((registration) => {
      // Chequear actualización solo al iniciar la app
      registration.update();
    });

    // Cuando un nuevo SW toma control, mostrar toast
    let refreshing = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) return;
      refreshing = true;

      toast("Nueva versión disponible", {
        description: "Recarga para ver los últimos cambios.",
        action: {
          label: "Actualizar",
          onClick: () => window.location.reload(),
        },
        duration: Infinity,
      });
    });
  }, []);

  return null;
}
