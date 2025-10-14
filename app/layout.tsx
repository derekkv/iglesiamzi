import type React from "react";
import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { MonthProvider } from "@/contexts/month-context";
import { Suspense } from "react";
import "./globals.css";
import { Toaster } from "sonner";
import { AuthProvider } from "@/contexts/auth-context";

export const metadata: Metadata = {
  title: "Iglesia",
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
            <MonthProvider>{children}</MonthProvider>
          </AuthProvider>
          <Toaster />
        </Suspense>
      </body>
    </html>
  );
}
