import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

export default function Page() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F3F1EC" }}>
      <Sidebar active="syndic-charges" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Topbar title="Charges" />
        <main style={{ flex: 1, overflowY: "auto", padding: 28 }}>
          <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 14, padding: "40px 32px", textAlign: "center" }}>
            <div style={{ fontSize: 52, marginBottom: 16 }}>∑</div>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: "0 0 8px" }}>Charges</h2>
            <p style={{ fontSize: 14, color: "#6b7280", maxWidth: 360, margin: "0 auto 24px" }}>
              Ce module est en cours de développement. Il sera disponible prochainement.
            </p>
            <a href="/syndic" style={{ background: "#2563eb", color: "#fff", borderRadius: 8, padding: "9px 20px", fontSize: 13, fontWeight: 500, textDecoration: "none" }}>
              ← Retour Syndic
            </a>
          </div>
        </main>
      </div>
    </div>
  );
}
