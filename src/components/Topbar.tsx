export default function Topbar({ title }: { title: string }) {
  return (
    <div style={{
      height: 56, display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 24px", background: "#fff", borderBottom: "1px solid #e5e7eb", flexShrink: 0,
    }}>
      <span style={{ fontWeight: 500, fontSize: 15 }}>{title}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button style={{
          background: "none", border: "1px solid #e5e7eb", borderRadius: 8,
          padding: "5px 10px", cursor: "pointer", fontSize: 14, position: "relative",
        }}>
          🔔 <span style={{
            background: "#7c3aed", color: "#fff", borderRadius: 10,
            padding: "1px 6px", fontSize: 11, marginLeft: 4,
          }}>5</span>
        </button>
        <div style={{
          width: 32, height: 32, borderRadius: "50%", background: "#ede9fe",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, fontWeight: 600, color: "#7c3aed",
        }}>JL</div>
      </div>
    </div>
  );
}
