import Link from "next/link";
import MailBoard from "@/components/mail/MailBoard";

const GOLD = "#B8966A";

export default function MessageriePage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#F3F1EC", overflow: "hidden" }}>
      {/* Barre retour */}
      <div style={{ height: 44, flexShrink: 0, background: "#fff", borderBottom: "1px solid #E6E1D9", display: "flex", alignItems: "center", padding: "0 16px", gap: 12 }}>
        <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 7, background: "#F7F0E6", border: `1px solid ${GOLD}44`, borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, color: GOLD }}>
          ← Retour Collab
        </Link>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#1C1A17" }}>Messagerie</span>

        {/* Accès rapides */}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <QuickLink href="/taches"   icon="✅" label="Tâches" />
          <QuickLink href="/planning" icon="📅" label="Agenda" />
          <QuickLink href="/appels"   icon="📞" label="Appels" />
        </div>
      </div>
      {/* Contenu plein écran */}
      <div style={{ flex: 1, minHeight: 0 }}>
        <MailBoard />
      </div>
    </div>
  );
}

function QuickLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  return (
    <Link href={href} title={label} style={{
      textDecoration: "none", display: "flex", alignItems: "center", gap: 6,
      background: "#fff", border: "1px solid #E6E1D9", borderRadius: 8,
      padding: "5px 11px", fontSize: 12, fontWeight: 600, color: "#1C1A17",
    }}>
      <span style={{ fontSize: 13 }}>{icon}</span>
      <span>{label}</span>
    </Link>
  );
}
