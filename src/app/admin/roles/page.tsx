import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import RolesAdmin from "@/components/admin/RolesAdmin";

export default function AdminRolesPage() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F3F1EC" }}>
      <Sidebar active="admin" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Topbar title="Administration — Rôles & droits" />
        <RolesAdmin />
      </div>
    </div>
  );
}
