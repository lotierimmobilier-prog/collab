"use client";
import { useEffect, useState } from "react";
const GOLD = "#B8966A"; const BORDER = "#E6E1D9";
export default function BalanceCptPage() {
  const [data, setData] = useState<{ compte: string; libelle: string; debit: number; credit: number }[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    Promise.all([
      fetch("/api/appels-loyer").then(r => r.json()),
      fetch("/api/encaissements").then(r => r.json()),
      fetch("/api/depots-garantie").then(r => r.json()),
    ]).then(([appels, encs, depots]) => {
      const totalAppele = appels.reduce((s: number, a: { totalCC: number }) => s + a.totalCC, 0);
      const totalEnc    = encs.reduce((s: number, e: { montant: number }) => s + e.montant, 0);
      const totalDep    = depots.reduce((s: number, d: { montant: number }) => s + d.montant, 0);
      setData([
        { compte: "411", libelle: "Locataires",        debit: totalAppele, credit: totalEnc },
        { compte: "412", libelle: "Dépôts garantie",   debit: totalDep,    credit: 0 },
        { compte: "512", libelle: "Banque",             debit: totalEnc,    credit: 0 },
        { compte: "706", libelle: "Loyers",             debit: 0,           credit: totalAppele },
      ]);
    }).finally(() => setLoading(false));
  }, []);
  const totalD = data.reduce((s, d) => s + d.debit, 0);
  const totalC = data.reduce((s, d) => s + d.credit, 0);
  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1C1A17", marginBottom: 6 }}>Balance comptes</h1>
      <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 20 }}>Synthèse par compte comptable</p>
      {loading ? <div style={{ color: "#9ca3af", padding: 40, textAlign: "center" }}>Chargement…</div> : (
        <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${BORDER}`, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ background: "#FAFAF8", borderBottom: `1px solid ${BORDER}` }}>
              {["Compte","Libellé","Débit","Crédit","Solde"].map(h => <th key={h} style={{ padding: "10px 14px", fontSize: 11, fontWeight: 600, color: "#6b7280", textAlign: h === "Débit" || h === "Crédit" || h === "Solde" ? "right" : "left", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {data.map(d => {
                const solde = d.debit - d.credit;
                return (
                  <tr key={d.compte} style={{ borderBottom: "1px solid #f3f4f6" }} onMouseEnter={e => (e.currentTarget.style.background = "#fafaf8")} onMouseLeave={e => (e.currentTarget.style.background = "#fff")}>
                    <td style={{ padding: "11px 14px", fontWeight: 700, color: GOLD, fontSize: 13 }}>{d.compte}</td>
                    <td style={{ padding: "11px 14px", fontSize: 13 }}>{d.libelle}</td>
                    <td style={{ padding: "11px 14px", fontSize: 12, textAlign: "right" }}>{d.debit.toLocaleString("fr-FR")} €</td>
                    <td style={{ padding: "11px 14px", fontSize: 12, textAlign: "right" }}>{d.credit.toLocaleString("fr-FR")} €</td>
                    <td style={{ padding: "11px 14px", fontSize: 13, textAlign: "right", fontWeight: 700, color: solde >= 0 ? "#059669" : "#DC2626" }}>{solde.toLocaleString("fr-FR")} €</td>
                  </tr>
                );
              })}
              <tr style={{ background: "#FAFAF8", borderTop: `2px solid ${BORDER}` }}>
                <td colSpan={2} style={{ padding: "10px 14px", fontWeight: 700, fontSize: 12 }}>Total</td>
                <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, fontSize: 12 }}>{totalD.toLocaleString("fr-FR")} €</td>
                <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, fontSize: 12 }}>{totalC.toLocaleString("fr-FR")} €</td>
                <td style={{ padding: "10px 14px", textAlign: "right", fontWeight: 700, color: totalD - totalC >= 0 ? "#059669" : "#DC2626" }}>{(totalD - totalC).toLocaleString("fr-FR")} €</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
