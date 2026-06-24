import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import Auguste from "@/components/Auguste";

export const metadata: Metadata = {
  title: "Collab — Gestion d'agence",
  description: "Outil de gestion pour votre agence et vos franchisés",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <SessionProvider>
          {children}
          <Auguste />
        </SessionProvider>
      </body>
    </html>
  );
}
