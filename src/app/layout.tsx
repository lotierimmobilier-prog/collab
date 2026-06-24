import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Collab — Gestion d'agence",
  description: "Outil de gestion pour votre agence et vos franchisés",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
