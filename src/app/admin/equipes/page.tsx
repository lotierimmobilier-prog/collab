import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import TeamsAdmin from "@/components/admin/TeamsAdmin";

export default function AdminTeamsPage() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F3F1EC" }}>
      <Sidebar active="admin" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100vh", overflow: "hidden" }}>
        <Topbar title="Administration — Équipes" />
        <div style={{ flex: 1, background: "#fff", margin: "0 0", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <TeamsAdmin />
        </div>
      </div>
    </div>
  );
}
