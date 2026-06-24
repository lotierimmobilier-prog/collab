const GOLD = "#B8966A";
const GOLD_BG = "#F7F0E6";
const DARK = "#1C1A17";
const BORDER = "#E6E1D9";

export default function Topbar({ title }: { title: string }) {
  return (
    <div style={{
      height: 52, display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 24px", background: "#fff", borderBottom: `1px solid ${BORDER}`, flexShrink: 0,
    }}>
      <span style={{ fontWeight: 600, fontSize: 14, color: DARK, letterSpacing: "0.01em" }}>{title}</span>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <button style={{
          background: "none", border: `1px solid ${BORDER}`, borderRadius: 8,
          padding: "5px 11px", cursor: "pointer", fontSize: 13, color: "#78726B",
          display: "flex", alignItems: "center", gap: 6,
        }}>
          ◎ <span style={{
            background: GOLD, color: "#fff", borderRadius: 10,
            padding: "1px 6px", fontSize: 10, fontWeight: 600,
          }}>5</span>
        </button>
        <div style={{
          width: 32, height: 32, borderRadius: "50%", background: GOLD_BG,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontWeight: 700, color: GOLD, cursor: "pointer",
        }}>JL</div>
      </div>
    </div>
  );
}
