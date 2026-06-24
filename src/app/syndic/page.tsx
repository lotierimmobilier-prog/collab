import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import SyndicDashboard from "@/components/syndic/SyndicDashboard";

export default function SyndicPage() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F3F1EC" }}>
      <Sidebar active="syndic" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Topbar title="Syndic" />
        <main style={{ flex: 1, overflowY: "auto" }}>
          <SyndicDashboard />
        </main>
      </div>
    </div>
  );
}
