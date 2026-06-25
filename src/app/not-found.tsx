import Link from "next/link";

const GOLD = "#B8966A"; const DARK = "#1C1A17"; const BORDER = "#E6E1D9";

const BLAGUES = [
  "Cette page est partie estimer un bien… elle n'est pas encore revenue.",
  "On a cherché partout, même dans les combles aménageables : rien.",
  "Page introuvable. Elle a dû changer d'adresse sans laisser de mandat.",
  "Ici, c'est encore un terrain à bâtir. Les travaux avancent.",
  "Cette pièce n'est pas sur le plan… pour l'instant.",
];

export default function NotFound() {
  // Choix stable côté serveur (évite l'hydratation aléatoire)
  const blague = BLAGUES[new Date().getDate() % BLAGUES.length];

  return (
    <div style={{ minHeight: "100vh", background: "#F3F1EC", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ maxWidth: 460, width: "100%", background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 16, padding: "36px 32px", textAlign: "center", boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Lotier Immobilier" style={{ height: 40, width: "auto", marginBottom: 20, opacity: 0.9 }} />
        <div style={{ display: "inline-block", fontSize: 12, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: GOLD, border: `1px solid ${GOLD}55`, borderRadius: 999, padding: "4px 12px", marginBottom: 16 }}>
          Page en travaux
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: DARK, margin: "0 0 10px" }}>Rien à visiter ici… pour le moment</h1>
        <p style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.6, margin: "0 0 24px" }}>{blague}</p>
        <Link href="/" style={{ display: "inline-block", background: GOLD, color: "#fff", textDecoration: "none", borderRadius: 10, padding: "11px 22px", fontSize: 14, fontWeight: 600 }}>
          Retour au tableau de bord
        </Link>
      </div>
    </div>
  );
}
