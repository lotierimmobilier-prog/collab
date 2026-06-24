import Card from "./Card";

const events = [
  { time: "09:30", label: "État des lieux — Rue Morel 4", sub: "Entrée — Famille Dupont", color: "#F7F0E6" },
  { time: "11:00", label: "Appel franchisé Bordeaux", sub: "Point mensuel", color: "#ecfdf5" },
  { time: "14:00", label: "Signature bail — Studio Centre", sub: "Mme Leclerc", color: "#fffbeb" },
  { time: "16:30", label: "Visite — T3 Quartier Nord", sub: "M. et Mme Fontaine", color: "#f3f4f6" },
];

export default function AgendaToday() {
  return (
    <Card title="Rendez-vous aujourd'hui" action={{ label: "Planning", href: "/planning" }}>
      {events.map((e, i) => (
        <div key={i} style={{
          display: "flex", gap: 10, alignItems: "flex-start",
          padding: "8px 10px", borderRadius: 8, background: e.color, marginBottom: 6,
        }}>
          <div style={{ fontSize: 11, color: "#6b7280", width: 44, flexShrink: 0, paddingTop: 2 }}>{e.time}</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>{e.label}</div>
            <div style={{ fontSize: 11, color: "#6b7280" }}>{e.sub}</div>
          </div>
        </div>
      ))}
    </Card>
  );
}
