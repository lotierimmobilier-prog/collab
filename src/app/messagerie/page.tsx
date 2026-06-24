import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import MailBoard from "@/components/mail/MailBoard";

export default function MessageriePage() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F3F1EC" }}>
      <Sidebar active="mail" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <Topbar title="Messagerie" />
        <MailBoard />
      </div>
    </div>
  );
}
