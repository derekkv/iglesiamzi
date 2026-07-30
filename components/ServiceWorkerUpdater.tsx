"use client";

import { useEffect } from "react";
import { toast } from "sonner";

export function ServiceWorkerUpdater() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let refreshing = false;

    const showUpdateToast = () => {
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
    };

    // Cuando un nuevo SW toma control
    navigator.serviceWorker.addEventListener("controllerchange", showUpdateToast);

    navigator.serviceWorker.ready.then((registration) => {
      // Chequear actualización al iniciar
      registration.update();

      // Escuchar cuando se encuentra un nuevo SW
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          // El nuevo SW se instaló y está listo para activarse
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            // Hay un SW existente (no es la primera instalación)
            showUpdateToast();
          }
        });
      });
    });

    // También chequear periódicamente (cada 5 minutos) por si el usuario deja la app abierta
    const interval = setInterval(() => {
      navigator.serviceWorker.ready.then((registration) => {
        registration.update();
      });
    }, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return null;
}
