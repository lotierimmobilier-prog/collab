import Card from "./Card";

const tasks = [
  { label: "Renouvellement bail — Apt 12B", sub: "Échéance demain", tag: "Urgent", color: "#fef2f2", textColor: "#991b1b" },
  { label: "Relance loyer impayé — M. Roux", sub: "Mai 2026", tag: "Urgent", color: "#fef2f2", textColor: "#991b1b" },
  { label: "Rapport mensuel franchisé Lyon", sub: "Avant vendredi", tag: "Moyen", color: "#fffbeb", textColor: "#92400e" },
];

export default function TaskList() {
  return (
    <Card title="Tâches urgentes" action={{ label: "Voir tout", href: "/taches" }}>
      {tasks.map((t, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "10px 0", borderBottom: i < tasks.length - 1 ? "1px solid #f3f4f6" : "none",
        }}>
          <span style={{
            background: t.color, color: t.textColor, borderRadius: 6,
            padding: "2px 8px", fontSize: 11, fontWeight: 500, whiteSpace: "nowrap",
          }}>{t.tag}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.label}</div>
            <div style={{ fontSize: 11, color: "#9ca3af" }}>{t.sub}</div>
          </div>
        </div>
      ))}
    </Card>
  );
}
