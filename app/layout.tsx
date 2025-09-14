import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { MonthProvider } from "@/contexts/month-context"
import { Suspense } from "react"
import "./globals.css"
import { Toaster } from 'sonner'

export const metadata: Metadata = {
  title: "Iglesia"
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es">
      <body className={`font-sans ${GeistSans.variable} ${GeistMono.variable}`}>
      
        <Suspense fallback={null}>
          <MonthProvider>{children}</MonthProvider>
    <Toaster />
        </Suspense>
      </body>
    </html>
  )
}
