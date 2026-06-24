import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import KnowledgeAdmin from "@/components/admin/KnowledgeAdmin";

export default function KnowledgePage() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F3F1EC" }}>
      <Sidebar active="admin-knowledge" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Topbar title="Base de connaissance Auguste" />
        <main style={{ flex: 1, padding: "24px", overflowY: "auto" }}>
          <KnowledgeAdmin />
        </main>
      </div>
    </div>
  );
}
