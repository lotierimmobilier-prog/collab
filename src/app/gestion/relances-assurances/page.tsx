"use client";
import { useEffect, useState } from "react";
const GOLD = "#B8966A"; const BORDER = "#E6E1D9";
interface Bail { id: string; reference: string; endDate: string | null; lot: { label: string | null; address: string }; tenants: { tenant: { prenom: string; nom: string; email: string | null } }[] }
export default function RelancesAssurancesPage() {
  const [baux, setBaux] = useState<Bail[]>([]);
  useEffect(() => { fetch("/api/baux").then(r => r.json()).then((b: (Bail & { status: string })[]) => setBaux(b.filter(x => x.status === "active"))); }, []);
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1C1A17", marginBottom: 6 }}>Relances assurances</h1>
      <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 20 }}>Suivi des attestations d'assurance habitation</p>
      <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "14px 18px", marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#92400E" }}>⚠ Vérifiez chaque année que vos locataires ont bien fourni leur attestation d'assurance.</div>
      </div>
      <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ background: "#FAFAF8", borderBottom: `1px solid ${BORDER}` }}>
            {["Bail","Lot","Locataire","Email","Attestation"].map(h => <th key={h} style={{ padding: "10px 14px", fontSize: 11, fontWeight: 600, color: "#6b7280", textAlign: "left", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {baux.length === 0 && <tr><td colSpan={5} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Aucun bail actif</td></tr>}
            {baux.map(b => {
              const tenant = b.tenants[0]?.tenant;
              return (
                <tr key={b.id} style={{ borderBottom: "1px solid #f3f4f6" }} onMouseEnter={e => (e.currentTarget.style.background = "#fafaf8")} onMouseLeave={e => (e.currentTarget.style.background = "#fff")}>
                  <td style={{ padding: "12px 14px", fontWeight: 600, fontSize: 12, color: GOLD }}>{b.reference}</td>
                  <td style={{ padding: "12px 14px", fontSize: 12 }}>{b.lot.label || b.lot.address}</td>
                  <td style={{ padding: "12px 14px", fontSize: 12 }}>{tenant ? `${tenant.prenom} ${tenant.nom}` : "—"}</td>
                  <td style={{ padding: "12px 14px", fontSize: 12, color: "#6b7280" }}>{tenant?.email || "—"}</td>
                  <td style={{ padding: "12px 14px" }}>
                    <select style={{ height: 28, border: `1px solid ${BORDER}`, borderRadius: 5, padding: "0 8px", fontSize: 11, outline: "none", background: "#fff", cursor: "pointer" }}>
                      <option value="ok">✓ Reçue</option>
                      <option value="attente">En attente</option>
                      <option value="relance">Relancé</option>
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
