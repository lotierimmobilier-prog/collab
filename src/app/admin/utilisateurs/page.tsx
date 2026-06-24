import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import UsersAdmin from "@/components/admin/UsersAdmin";

export default function AdminUsersPage() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F3F1EC" }}>
      <Sidebar active="admin" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Topbar title="Administration — Utilisateurs" />
        <UsersAdmin />
      </div>
    </div>
  );
}
