"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

const GOLD = "#B8966A"; const BORDER = "#E6E1D9";

interface Appel { id: string; reference: string; periode: string; totalCC: number; echeance: string; status: string; bail: { reference: string; lot: { label: string | null; address: string }; tenants: { tenant: { prenom: string; nom: string; email: string | null; phone: string | null } }[] } }

export default function ImpayesPage() {
  const [impayed, setImpayed] = useState<Appel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/appels-loyer").then(r => r.json()).then((appels: Appel[]) => {
      setImpayed(appels.filter(a => a.status === "impaye" || (a.status === "emis" && new Date(a.echeance) < new Date())));
    }).finally(() => setLoading(false));
  }, []);

  const total = impayed.reduce((s, a) => s + a.totalCC, 0);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1C1A17", margin: 0 }}>Impayés</h1>
          <p style={{ fontSize: 12, color: "#6b7280", margin: "4px 0 0" }}>{impayed.length} appel{impayed.length > 1 ? "s" : ""} en retard</p>
        </div>
        <Link href="/gestion/relances-impayes" style={{ background: "#DC2626", color: "#fff", textDecoration: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 600 }}>Gérer les relances →</Link>
      </div>

      <div style={{ background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 10, padding: "16px 20px", marginBottom: 20 }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: "#DC2626" }}>{total.toLocaleString("fr-FR")} €</div>
        <div style={{ fontSize: 11, color: "#991B1B", marginTop: 2 }}>Total des impayés</div>
      </div>

      {loading ? <div style={{ color: "#9ca3af", padding: 40, textAlign: "center" }}>Chargement…</div> : (
        <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${BORDER}`, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ background: "#FAFAF8", borderBottom: `1px solid ${BORDER}` }}>
              {["Référence","Période","Bail / Lot","Locataire","Contact","Montant","Échéance"].map(h => (
                <th key={h} style={{ padding: "10px 14px", fontSize: 11, fontWeight: 600, color: "#6b7280", textAlign: "left", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {impayed.length === 0 && <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#059669" }}>✓ Aucun impayé</td></tr>}
              {impayed.map(a => {
                const retard = Math.floor((new Date().getTime() - new Date(a.echeance).getTime()) / 86400000);
                const tenant = a.bail.tenants[0]?.tenant;
                return (
                  <tr key={a.id} style={{ borderBottom: "1px solid #f3f4f6" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#fff5f5")}
                    onMouseLeave={e => (e.currentTarget.style.background = "#fff")}>
                    <td style={{ padding: "12px 14px", fontWeight: 700, fontSize: 12, color: "#DC2626" }}>{a.reference}</td>
                    <td style={{ padding: "12px 14px", fontSize: 12 }}>{a.periode}</td>
                    <td style={{ padding: "12px 14px" }}>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>{a.bail.reference}</div>
                      <div style={{ fontSize: 11, color: "#6b7280" }}>{a.bail.lot.label || a.bail.lot.address}</div>
                    </td>
                    <td style={{ padding: "12px 14px", fontSize: 12 }}>{tenant ? `${tenant.prenom} ${tenant.nom}` : "—"}</td>
                    <td style={{ padding: "12px 14px", fontSize: 11, color: "#6b7280" }}>{tenant?.phone || tenant?.email || "—"}</td>
                    <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 700, color: "#DC2626" }}>{a.totalCC.toLocaleString("fr-FR")} €</td>
                    <td style={{ padding: "12px 14px", fontSize: 12 }}>
                      {new Date(a.echeance).toLocaleDateString("fr-FR")}
                      {retard > 0 && <div style={{ fontSize: 10, color: "#DC2626", fontWeight: 600 }}>+{retard}j</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
