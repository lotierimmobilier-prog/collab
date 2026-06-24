import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

export default function GestionLocativePage() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F3F1EC" }}>
      <Sidebar active="gestion-loc" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Topbar title="Gestion locative" />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40, gap: 20 }}>
          <div style={{ fontSize: 56 }}>🏠</div>
          <div style={{ textAlign: "center" }}>
            <h2 style={{ fontSize: 22, fontWeight: 700, color: "#1C1A17", marginBottom: 8 }}>
              Module Gestion Locative
            </h2>
            <p style={{ fontSize: 14, color: "#6b7280", maxWidth: 480, lineHeight: 1.7 }}>
              Ce module est en cours de développement. Il permettra de gérer l&apos;ensemble
              du parc locatif : propriétaires, locataires, baux, loyers, quittances,
              états des lieux et documents contractuels.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, maxWidth: 640, width: "100%", marginTop: 16 }}>
            {[
              { icon: "👤", label: "Propriétaires",    desc: "Fiche propriétaire, contacts, mandats" },
              { icon: "🏡", label: "Biens",             desc: "Parc immobilier, caractéristiques" },
              { icon: "👥", label: "Locataires",        desc: "Dossiers, caution, garanties" },
              { icon: "📄", label: "Baux",              desc: "Contrats, renouvellements, révisions" },
              { icon: "💶", label: "Loyers",            desc: "Appels, encaissements, impayés" },
              { icon: "🔧", label: "Maintenance",       desc: "Travaux, sinistres, interventions" },
            ].map(m => (
              <div key={m.label} style={{ background: "#fff", border: "1px solid #E6E1D9", borderRadius: 12, padding: 20, textAlign: "center", opacity: 0.7 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>{m.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1C1A17", marginBottom: 4 }}>{m.label}</div>
                <div style={{ fontSize: 11, color: "#9ca3af", lineHeight: 1.5 }}>{m.desc}</div>
                <div style={{ marginTop: 10, background: "#F7F0E6", borderRadius: 6, padding: "4px 8px", fontSize: 10, color: "#B8966A", fontWeight: 600 }}>Bientôt disponible</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
