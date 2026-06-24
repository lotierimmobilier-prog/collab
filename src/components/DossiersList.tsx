import Card from "./Card";

const dossiers = [
  { name: "Martin Clément", bien: "T2 Carnot", sub: "Dossier complet · En attente", tag: "Validation", bg: "#fffbeb", text: "#92400e" },
  { name: "Élodie Bertrand", bien: "Studio", sub: "Garant manquant", tag: "Incomplet", bg: "#fef2f2", text: "#991b1b" },
  { name: "Karim Mansouri", bien: "T3 Centre", sub: "Signé · Remise de clés", tag: "Signé", bg: "#ecfdf5", text: "#065f46" },
  { name: "Sara Petit", bien: "Maison Rives", sub: "Dossier en constitution", tag: "En cours", bg: "#f3f4f6", text: "#374151" },
];

export default function DossiersList() {
  return (
    <Card title="Dossiers en cours">
      {dossiers.map((d, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 0", borderBottom: i < dossiers.length - 1 ? "1px solid #f3f4f6" : "none",
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>{d.name} — {d.bien}</div>
            <div style={{ fontSize: 11, color: "#9ca3af" }}>{d.sub}</div>
          </div>
          <span style={{
            background: d.bg, color: d.text, borderRadius: 6,
            padding: "2px 8px", fontSize: 11, fontWeight: 500, whiteSpace: "nowrap",
          }}>{d.tag}</span>
        </div>
      ))}
    </Card>
  );
}
