export default function StatCard({ label, value, sub, icon }: {
  label: string; value: string; sub?: string; icon: string;
}) {
  return (
    <div style={{
      background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb",
      padding: "16px 18px",
    }}>
      <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
        <span>{icon}</span> {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 600, color: "#111827", marginBottom: 2 }}>{value || "—"}</div>
      {sub && <div style={{ fontSize: 12, color: "#9ca3af" }}>{sub}</div>}
    </div>
  );
}
