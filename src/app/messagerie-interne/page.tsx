import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import InternalChat from "@/components/chat/InternalChat";

export default function MessagerieInternePage() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F3F1EC" }}>
      <Sidebar active="chat" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Topbar title="Messagerie interne" />
        <main style={{ flex: 1, display: "flex", minHeight: 0, overflow: "hidden" }}>
          <InternalChat />
        </main>
      </div>
    </div>
  );
}
