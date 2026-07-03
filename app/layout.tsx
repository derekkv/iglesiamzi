import type React from "react";
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { MonthProvider } from "@/contexts/month-context";
import { Suspense } from "react";
//@ts-ignore
import './globals.css'
import { Toaster } from "sonner";
import { AuthProvider } from "@/contexts/auth-context";
import { SecurityCheckProvider } from "@/contexts/security-context";
import { SecurityKeyDialog } from "@/components/SecurityKeyDialog";
import { ServiceWorkerUpdater } from "@/components/ServiceWorkerUpdater";
import { ServiceAlertModal } from "@/components/ServiceAlertModal";
import { PushNotificationPrompt } from "@/components/PushNotificationPrompt";
import { NotificacionModal } from "@/components/NotificacionModal";

export const metadata: Metadata = {
  title: "Regalo de Dios",
  manifest: "/manifest.json",
  icons: {
    icon: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
        <Suspense fallback={null}>
          <AuthProvider>
                    <SecurityCheckProvider>
            <MonthProvider>{children}</MonthProvider>
              <SecurityKeyDialog />
              <ServiceAlertModal />
              <PushNotificationPrompt />
              <NotificacionModal />
        </SecurityCheckProvider>
          </AuthProvider>
          <Toaster />
          <ServiceWorkerUpdater />
        </Suspense>
      </body>
    </html>
  );
}
