import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import AugusteLogs from "@/components/admin/AugusteLogs";

export default function AdminAugusteHistoriquePage() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F3F1EC" }}>
      <Sidebar active="admin-auguste-logs" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Topbar title="Historique Auguste" />
        <main style={{ flex: 1, padding: "24px", overflowY: "auto" }}>
          <AugusteLogs />
        </main>
      </div>
    </div>
  );
}
