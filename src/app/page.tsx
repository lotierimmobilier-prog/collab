import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import Dashboard from "@/components/Dashboard";

export default function Home() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f3f4f6" }}>
      <Sidebar active="dashboard" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Topbar title="Tableau de bord" />
        <main style={{ flex: 1, padding: "24px", overflowY: "auto" }}>
          <Dashboard />
        </main>
      </div>
    </div>
  );
}
