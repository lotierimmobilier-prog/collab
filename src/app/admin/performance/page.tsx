import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import PerformanceAdmin from "@/components/admin/PerformanceAdmin";

export default function AdminPerformancePage() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F3F1EC" }}>
      <Sidebar active="admin" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100vh", overflow: "hidden" }}>
        <Topbar title="Administration — Performances" />
        <div style={{ flex: 1, background: "#F3F1EC", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <PerformanceAdmin />
        </div>
      </div>
    </div>
  );
}
