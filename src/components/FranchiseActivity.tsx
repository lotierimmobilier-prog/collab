import Card from "./Card";

const franchises = [
  { code: "LY", name: "Lyon", biens: 68, loues: 63, pct: 93, color: "#f5f3ff", textColor: "#7c3aed" },
  { code: "BX", name: "Bordeaux", biens: 45, loues: 39, pct: 87, color: "#ecfdf5", textColor: "#059669" },
  { code: "MA", name: "Marseille", biens: 52, loues: 41, pct: 79, color: "#fffbeb", textColor: "#d97706" },
  { code: "TO", name: "Toulouse", biens: 38, loues: 27, pct: 71, color: "#fef2f2", textColor: "#dc2626" },
];

function tagColor(pct: number) {
  if (pct >= 90) return { bg: "#dcfce7", text: "#166534" };
  if (pct >= 80) return { bg: "#dcfce7", text: "#166534" };
  if (pct >= 75) return { bg: "#fef9c3", text: "#854d0e" };
  return { bg: "#fee2e2", text: "#991b1b" };
}

export default function FranchiseActivity() {
  return (
    <Card title="Franchisés — activité">
      {franchises.map((f, i) => {
        const tc = tagColor(f.pct);
        return (
          <div key={i} style={{
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 0", borderBottom: i < franchises.length - 1 ? "1px solid #f3f4f6" : "none",
          }}>
            <div style={{
              width: 34, height: 34, borderRadius: "50%", background: f.color,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 600, color: f.textColor, flexShrink: 0,
            }}>{f.code}</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>{f.name}</div>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>{f.biens} biens · {f.loues} loués</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={{
                background: tc.bg, color: tc.text, borderRadius: 6,
                padding: "2px 8px", fontSize: 11, fontWeight: 500, display: "block", marginBottom: 4,
              }}>{f.pct} %</span>
              <div style={{ width: 80, height: 5, background: "#f3f4f6", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${f.pct}%`, height: "100%", background: tc.text, borderRadius: 3 }} />
              </div>
            </div>
          </div>
        );
      })}
    </Card>
  );
}
