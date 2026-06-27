import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import SystemHealth from "@/components/admin/SystemHealth";

export default function AdminSantePage() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F3F1EC" }}>
      <Sidebar active="admin-sante" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100vh", overflow: "hidden" }}>
        <Topbar title="Administration — Santé & performances" />
        <div style={{ flex: 1, background: "#F3F1EC", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <SystemHealth />
        </div>
      </div>
    </div>
  );
}
