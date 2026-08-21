import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import type { ReactNode } from "react";
import { getTheme } from "@teispace/next-themes/server";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { SessionLock } from "@/components/auth/session-lock";

export const metadata: Metadata = {
  title: "Coccinelle",
  description: "Réservation de voyages bus et avion — Coccinelle.",
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const initialTheme = await getTheme();

  return (
    <html
      lang="fr"
      className={`${GeistSans.variable} ${GeistMono.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-svh font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
          disableTransitionOnChange
          storage="local"
          initialTheme={initialTheme ?? "light"}
        >
          <SessionLock />
          {children}
          <Toaster richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
