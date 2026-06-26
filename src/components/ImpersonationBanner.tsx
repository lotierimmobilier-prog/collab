"use client";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

// Bandeau rouge affiché en haut de page lorsqu'un admin a « pris la main »
// sur un utilisateur. Permet de revenir à la session administrateur.
export default function ImpersonationBanner() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const impersonator = session?.user?.impersonatorId;
  if (!impersonator) return null;

  const who = `${session?.user?.prenom ?? ""} ${session?.user?.nom ?? ""}`.trim();

  async function back() {
    setBusy(true);
    try {
      await update({ impersonate: null });
      router.push("/admin/utilisateurs");
      router.refresh();
    } finally { setBusy(false); }
  }

  return (
    <div style={{
      position: "sticky", top: 0, zIndex: 9999,
      background: "#9B2C2C", color: "#fff",
      display: "flex", alignItems: "center", justifyContent: "center", gap: 14,
      padding: "8px 16px", fontSize: 13, fontWeight: 600,
      boxShadow: "0 2px 8px rgba(0,0,0,.2)",
    }}>
      <span>
        👤 Vous consultez le logiciel <strong>en tant que {who || "cet utilisateur"}</strong>
        {session?.user?.impersonatorName ? ` (admin : ${session.user.impersonatorName})` : ""}
      </span>
      <button onClick={back} disabled={busy} style={{
        background: "#fff", color: "#9B2C2C", border: "none", borderRadius: 8,
        padding: "5px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
      }}>
        {busy ? "…" : "← Revenir à l'administration"}
      </button>
    </div>
  );
}
