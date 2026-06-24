import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import LocatairesBoard from "@/components/locataires/LocatairesBoard";

export default function LocatairesPage() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F3F1EC" }}>
      <Sidebar active="locataires" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Topbar title="Dossiers locataires" />
        <LocatairesBoard />
      </div>
    </div>
  );
}
