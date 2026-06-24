import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import PlanningBoard from "@/components/planning/PlanningBoard";

export default function PlanningPage() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F3F1EC" }}>
      <Sidebar active="planning" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Topbar title="Planning" />
        <PlanningBoard />
      </div>
    </div>
  );
}
