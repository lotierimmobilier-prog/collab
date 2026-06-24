"use client";
import { useEffect, useState } from "react";

const GOLD = "#B8966A"; const BORDER = "#E6E1D9";

interface Row { tenant: string; bail: string; lot: string; totalAppele: number; totalEncaisse: number; solde: number }

export default function BalanceLocPage() {
  const [rows, setRows]       = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/appels-loyer").then(r => r.json()),
      fetch("/api/encaissements").then(r => r.json()),
    ]).then(([appels, encs]) => {
      const byBail: Record<string, Row> = {};
      for (const a of appels) {
        const key = a.bail.reference;
        if (!byBail[key]) byBail[key] = { bail: a.bail.reference, lot: a.bail.lot.label || a.bail.lot.address, tenant: a.bail.tenants.map((bt: { tenant: { prenom: string; nom: string } }) => `${bt.tenant.prenom} ${bt.tenant.nom}`).join(", "), totalAppele: 0, totalEncaisse: 0, solde: 0 };
        byBail[key].totalAppele += a.totalCC;
      }
      for (const e of encs) {
        const key = e.bail.reference;
        if (!byBail[key]) byBail[key] = { bail: e.bail.reference, lot: e.bail.lot.label || e.bail.lot.reference, tenant: e.bail.tenants.map((bt: { tenant: { prenom: string; nom: string } }) => `${bt.tenant.prenom} ${bt.tenant.nom}`).join(", "), totalAppele: 0, totalEncaisse: 0, solde: 0 };
        byBail[key].totalEncaisse += e.montant;
      }
      const result = Object.values(byBail).map(r => ({ ...r, solde: r.totalEncaisse - r.totalAppele }));
      result.sort((a, b) => a.solde - b.solde);
      setRows(result);
    }).finally(() => setLoading(false));
  }, []);

  const totalSolde = rows.reduce((s, r) => s + r.solde, 0);

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1C1A17", marginBottom: 6 }}>Balance locataires</h1>
      <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 20 }}>Synthèse appelé / encaissé par locataire</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 20 }}>
        <div style={{ background: "#fff", borderRadius: 10, padding: "14px 18px", border: `1px solid ${BORDER}` }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: GOLD }}>{rows.reduce((s, r) => s + r.totalAppele, 0).toLocaleString("fr-FR")} €</div>
          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>Total appelé</div>
        </div>
        <div style={{ background: "#F0FDF4", borderRadius: 10, padding: "14px 18px", border: "1px solid #BBF7D0" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#059669" }}>{rows.reduce((s, r) => s + r.totalEncaisse, 0).toLocaleString("fr-FR")} €</div>
          <div style={{ fontSize: 11, color: "#065F46", marginTop: 2 }}>Total encaissé</div>
        </div>
        <div style={{ background: totalSolde < 0 ? "#FEF2F2" : "#F0FDF4", borderRadius: 10, padding: "14px 18px", border: `1px solid ${totalSolde < 0 ? "#FCA5A5" : "#BBF7D0"}` }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: totalSolde < 0 ? "#DC2626" : "#059669" }}>{totalSolde.toLocaleString("fr-FR")} €</div>
          <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>Solde global</div>
        </div>
      </div>

      {loading ? <div style={{ color: "#9ca3af", padding: 40, textAlign: "center" }}>Chargement…</div> : (
        <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${BORDER}`, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ background: "#FAFAF8", borderBottom: `1px solid ${BORDER}` }}>
              {["Bail","Lot","Locataire","Appelé","Encaissé","Solde"].map(h => (
                <th key={h} style={{ padding: "10px 14px", fontSize: 11, fontWeight: 600, color: "#6b7280", textAlign: h === "Appelé" || h === "Encaissé" || h === "Solde" ? "right" : "left", textTransform: "uppercase", letterSpacing: "0.06em" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={6} style={{ padding: 40, textAlign: "center", color: "#9ca3af" }}>Aucune donnée</td></tr>}
              {rows.map((r, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#fafaf8")}
                  onMouseLeave={e => (e.currentTarget.style.background = "#fff")}>
                  <td style={{ padding: "11px 14px", fontSize: 12, fontWeight: 600, color: GOLD }}>{r.bail}</td>
                  <td style={{ padding: "11px 14px", fontSize: 12, color: "#374151" }}>{r.lot}</td>
                  <td style={{ padding: "11px 14px", fontSize: 12 }}>{r.tenant || "—"}</td>
                  <td style={{ padding: "11px 14px", fontSize: 12, textAlign: "right" }}>{r.totalAppele.toLocaleString("fr-FR")} €</td>
                  <td style={{ padding: "11px 14px", fontSize: 12, textAlign: "right", color: "#059669" }}>{r.totalEncaisse.toLocaleString("fr-FR")} €</td>
                  <td style={{ padding: "11px 14px", fontSize: 13, textAlign: "right", fontWeight: 700, color: r.solde < 0 ? "#DC2626" : "#059669" }}>
                    {r.solde.toLocaleString("fr-FR")} €
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
