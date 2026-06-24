"use client";
import { useEffect, useState } from "react";

const GOLD = "#B8966A"; const GOLD_BG = "#F7F0E6"; const BORDER = "#E6E1D9";
const IRL_HISTORY = [
  { periode: "T1 2026", valeur: 142.58, variation: 1.12 },
  { periode: "T4 2025", valeur: 141.00, variation: 0.83 },
  { periode: "T3 2025", valeur: 139.83, variation: 2.47 },
  { periode: "T2 2025", valeur: 136.44, variation: 3.51 },
];

interface Bail { id: string; reference: string; monthlyRent: number; startDate: string; lot: { label: string | null; address: string }; tenants: { tenant: { prenom: string; nom: string } }[] }

export default function RevisionPage() {
  const [baux, setBaux]   = useState<Bail[]>([]);
  const [loading, setLoading] = useState(true);
  const [irlRef, setIrlRef] = useState(136.44);
  const [irlNew, setIrlNew] = useState(142.58);

  useEffect(() => {
    fetch("/api/baux").then(r => r.json()).then((b: (Bail & { status: string })[]) => setBaux(b.filter(x => x.status === "active"))).finally(() => setLoading(false));
  }, []);

  const ratio = irlNew / irlRef;

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1C1A17", marginBottom: 6 }}>Révision des loyers</h1>
      <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 20 }}>Calcul de revalorisation selon l'Indice de Référence des Loyers (IRL)</p>

      {/* IRL */}
      <div style={{ background: GOLD_BG, border: `1px solid ${GOLD}44`, borderRadius: 12, padding: "18px 20px", marginBottom: 24 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#92400E", marginBottom: 12 }}>Paramètres IRL</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 14, alignItems: "flex-end" }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>IRL de référence</label>
            <input type="number" step="0.01" value={irlRef} onChange={e => setIrlRef(+e.target.value)} style={{ height: 36, border: `1px solid ${BORDER}`, borderRadius: 7, padding: "0 10px", fontSize: 13, outline: "none", background: "#fff", width: "100%", boxSizing: "border-box" as const }} />
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 4 }}>IRL nouveau</label>
            <input type="number" step="0.01" value={irlNew} onChange={e => setIrlNew(+e.target.value)} style={{ height: 36, border: `1px solid ${BORDER}`, borderRadius: 7, padding: "0 10px", fontSize: 13, outline: "none", background: "#fff", width: "100%", boxSizing: "border-box" as const }} />
          </div>
          <div style={{ background: "#fff", border: `1px solid ${GOLD}`, borderRadius: 8, padding: "8px 16px", textAlign: "center" as const }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: GOLD }}>+{((ratio - 1) * 100).toFixed(2)}%</div>
            <div style={{ fontSize: 10, color: "#92400E" }}>Revalorisation</div>
          </div>
        </div>
        <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
          {IRL_HISTORY.map(h => (
            <button key={h.periode} onClick={() => setIrlNew(h.valeur)} style={{ background: "#fff", border: `1px solid ${GOLD}44`, borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer", color: "#92400E" }}>
              {h.periode} : {h.valeur} (+{h.variation}%)
            </button>
          ))}
        </div>
      </div>

      {loading ? <div style={{ color: "#9ca3af", padding: 40, textAlign: "center" }}>Chargement…</div> : (
        <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${BORDER}`, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ background: "#FAFAF8", borderBottom: `1px solid ${BORDER}` }}>
              {["Bail","Lot","Locataire","Loyer actuel","Nouveau loyer","Hausse / mois","Hausse / an"].map(h => (
                <th key={h} style={{ padding: "10px 14px", fontSize: 11, fontWeight: 600, color: "#6b7280", textAlign: "left", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {baux.map(b => {
                const newRent = Math.round(b.monthlyRent * ratio * 100) / 100;
                const diff = newRent - b.monthlyRent;
                return (
                  <tr key={b.id} style={{ borderBottom: "1px solid #f3f4f6" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#fafaf8")}
                    onMouseLeave={e => (e.currentTarget.style.background = "#fff")}>
                    <td style={{ padding: "12px 14px", fontWeight: 700, fontSize: 12, color: GOLD }}>{b.reference}</td>
                    <td style={{ padding: "12px 14px", fontSize: 12 }}>{b.lot.label || b.lot.address}</td>
                    <td style={{ padding: "12px 14px", fontSize: 12 }}>{b.tenants.map(bt => `${bt.tenant.prenom} ${bt.tenant.nom}`).join(", ") || "—"}</td>
                    <td style={{ padding: "12px 14px", fontSize: 13 }}>{b.monthlyRent.toLocaleString("fr-FR")} €</td>
                    <td style={{ padding: "12px 14px", fontSize: 13, fontWeight: 700, color: GOLD }}>{newRent.toLocaleString("fr-FR")} €</td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: "#059669", fontWeight: 600 }}>+{diff.toFixed(2)} €</td>
                    <td style={{ padding: "12px 14px", fontSize: 12, color: "#059669" }}>+{(diff * 12).toFixed(2)} €</td>
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
