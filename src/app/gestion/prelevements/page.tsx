"use client";
import { useEffect, useState } from "react";
const GOLD = "#B8966A"; const BORDER = "#E6E1D9";
interface Bail { id: string; reference: string; monthlyRent: number; charges: number; lot: { label: string | null; address: string }; tenants: { tenant: { prenom: string; nom: string } }[] }
export default function PrelevementsPage() {
  const [baux, setBaux] = useState<Bail[]>([]);
  const [loading, setLoading] = useState(true);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  useEffect(() => { fetch("/api/baux").then(r => r.json()).then((b: (Bail & { status: string })[]) => setBaux(b.filter(x => x.status === "active"))).finally(() => setLoading(false)); }, []);
  const now = new Date();
  const total = baux.filter(b => checked.has(b.id)).reduce((s, b) => s + b.monthlyRent + b.charges, 0);
  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1C1A17", margin: 0 }}>Prélèvements</h1>
          <p style={{ fontSize: 12, color: "#6b7280", margin: "4px 0 0" }}>Génération des prélèvements mensuels</p>
        </div>
        <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 700, color: "#059669" }}>
          Total sélectionné : {total.toLocaleString("fr-FR")} €
        </div>
      </div>
      <div style={{ background: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 10, padding: "12px 16px", marginBottom: 20, fontSize: 12, color: "#4338CA" }}>
        Cochez les baux à prélever ce mois ({now.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })}) puis exportez le fichier SEPA.
      </div>
      {loading ? <div style={{ color: "#9ca3af", padding: 40, textAlign: "center" }}>Chargement…</div> : (
        <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ background: "#FAFAF8", borderBottom: `1px solid ${BORDER}` }}>
              <th style={{ padding: "10px 14px", width: 40 }}><input type="checkbox" onChange={e => setChecked(e.target.checked ? new Set(baux.map(b => b.id)) : new Set())} style={{ accentColor: GOLD }} /></th>
              {["Bail","Lot","Locataire","Montant CC"].map(h => <th key={h} style={{ padding: "10px 14px", fontSize: 11, fontWeight: 600, color: "#6b7280", textAlign: "left", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {baux.map(b => (
                <tr key={b.id} style={{ borderBottom: "1px solid #f3f4f6", background: checked.has(b.id) ? "#F0FDF4" : "#fff" }}
                  onMouseEnter={e => !checked.has(b.id) && (e.currentTarget.style.background = "#fafaf8")}
                  onMouseLeave={e => !checked.has(b.id) && (e.currentTarget.style.background = "#fff")}>
                  <td style={{ padding: "12px 14px" }}><input type="checkbox" checked={checked.has(b.id)} onChange={e => setChecked(p => { const n = new Set(p); e.target.checked ? n.add(b.id) : n.delete(b.id); return n; })} style={{ accentColor: GOLD }} /></td>
                  <td style={{ padding: "12px 14px", fontWeight: 600, fontSize: 12, color: GOLD }}>{b.reference}</td>
                  <td style={{ padding: "12px 14px", fontSize: 12 }}>{b.lot.label || b.lot.address}</td>
                  <td style={{ padding: "12px 14px", fontSize: 12 }}>{b.tenants.map(bt => `${bt.tenant.prenom} ${bt.tenant.nom}`).join(", ") || "—"}</td>
                  <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 700, color: GOLD }}>{(b.monthlyRent + b.charges).toLocaleString("fr-FR")} €</td>
                </tr>
              ))}
            </tbody>
          </table>
          {checked.size > 0 && (
            <div style={{ padding: "12px 16px", borderTop: `1px solid ${BORDER}`, display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button style={{ background: "#6366F1", color: "#fff", border: "none", borderRadius: 7, padding: "8px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                Exporter SEPA ({checked.size} prélèvement{checked.size > 1 ? "s" : ""} · {total.toLocaleString("fr-FR")} €)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
