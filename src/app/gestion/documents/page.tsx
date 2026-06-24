"use client";
const BORDER = "#E6E1D9"; const GOLD = "#B8966A";
const CATS = [
  { label: "Baux signés", icon: "📄", desc: "Contrats de location" },
  { label: "États des lieux", icon: "🏠", desc: "Entrées et sorties" },
  { label: "Quittances de loyer", icon: "💶", desc: "Générées automatiquement" },
  { label: "Attestations assurance", icon: "🛡", desc: "Par locataire" },
  { label: "Diagnostics", icon: "📋", desc: "DPE, amiante, plomb…" },
  { label: "Correspondances", icon: "✉", desc: "Courriers et emails" },
];
export default function DocumentsPage() {
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1C1A17", marginBottom: 6 }}>Documents</h1>
      <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 24 }}>Gestion documentaire du portefeuille</p>
      <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "14px 18px", marginBottom: 24, fontSize: 13, color: "#92400E" }}>
        Module GED en cours de développement — les documents seront attachables directement aux baux et locataires.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
        {CATS.map(c => (
          <div key={c.label} style={{ background: "#fff", borderRadius: 12, border: `1px solid ${BORDER}`, padding: "18px 20px", cursor: "pointer" }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = GOLD)}
            onMouseLeave={e => (e.currentTarget.style.borderColor = BORDER)}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>{c.icon}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#1C1A17", marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 11, color: "#6b7280" }}>{c.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
