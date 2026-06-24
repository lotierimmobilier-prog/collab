import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import TaskBoard from "@/components/tasks/TaskBoard";

export default function TachesPage() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F3F1EC" }}>
      <Sidebar active="tasks" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Topbar title="Tâches" />
        <TaskBoard />
      </div>
    </div>
  );
}
