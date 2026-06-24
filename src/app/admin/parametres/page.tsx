import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import AdminSettings from "@/components/admin/AdminSettings";

export default function AdminParametresPage() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F3F1EC" }}>
      <Sidebar active="admin-settings" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Topbar title="Paramètres" />
        <main style={{ flex: 1, padding: "24px", overflowY: "auto" }}>
          <AdminSettings />
        </main>
      </div>
    </div>
  );
}
