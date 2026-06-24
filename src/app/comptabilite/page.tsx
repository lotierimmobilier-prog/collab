import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import ComptaBoard from "@/components/compta/ComptaBoard";

export default function ComptaPage() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f3f4f6" }}>
      <Sidebar active="compta" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Topbar title="Comptabilité" />
        <ComptaBoard />
      </div>
    </div>
  );
}
