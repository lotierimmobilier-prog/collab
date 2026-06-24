"use client";
import { useEffect, useState } from "react";

const GOLD = "#B8966A"; const BORDER = "#E6E1D9";
const MONTHS = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];

export default function TresoreriePage() {
  const [data, setData] = useState<{ mois: string; encaisse: number; appele: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/encaissements").then(r => r.json()),
      fetch("/api/appels-loyer").then(r => r.json()),
    ]).then(([encs, appels]) => {
      const year = new Date().getFullYear();
      const byMonth: Record<number, { encaisse: number; appele: number }> = {};
      for (let m = 0; m < 12; m++) byMonth[m] = { encaisse: 0, appele: 0 };

      for (const e of encs) {
        const d = new Date(e.dateReglement);
        if (d.getFullYear() === year) byMonth[d.getMonth()].encaisse += e.montant;
      }
      for (const a of appels) {
        const [y, m] = a.periode.split("-").map(Number);
        if (y === year) byMonth[m - 1].appele += a.totalCC;
      }
      setData(Object.entries(byMonth).map(([k, v]) => ({ mois: MONTHS[+k], ...v })));
    }).finally(() => setLoading(false));
  }, []);

  const totalEnc  = data.reduce((s, d) => s + d.encaisse, 0);
  const totalApp  = data.reduce((s, d) => s + d.appele, 0);
  const maxVal    = Math.max(...data.map(d => Math.max(d.encaisse, d.appele)), 1);

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1C1A17", marginBottom: 6 }}>Trésorerie</h1>
      <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 20 }}>Vue annuelle — {new Date().getFullYear()}</p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 14, marginBottom: 24 }}>
        <div style={{ background: "#F0FDF4", borderRadius: 10, padding: "16px 20px", border: "1px solid #BBF7D0" }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#059669" }}>{totalEnc.toLocaleString("fr-FR")} €</div>
          <div style={{ fontSize: 11, color: "#065F46", marginTop: 2 }}>Total encaissé {new Date().getFullYear()}</div>
        </div>
        <div style={{ background: "#EEF2FF", borderRadius: 10, padding: "16px 20px", border: "1px solid #C7D2FE" }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#6366F1" }}>{totalApp.toLocaleString("fr-FR")} €</div>
          <div style={{ fontSize: 11, color: "#4338CA", marginTop: 2 }}>Total appelé {new Date().getFullYear()}</div>
        </div>
      </div>

      {loading ? <div style={{ color: "#9ca3af", padding: 40, textAlign: "center" }}>Chargement…</div> : (
        <div style={{ background: "#fff", borderRadius: 12, border: `1px solid ${BORDER}`, padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
          <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}><span style={{ width: 12, height: 12, background: "#059669", borderRadius: 3, display: "inline-block" }} />Encaissé</span>
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}><span style={{ width: 12, height: 12, background: "#6366F1", borderRadius: 3, display: "inline-block" }} />Appelé</span>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 180 }}>
            {data.map((d, i) => (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                <div style={{ width: "100%", display: "flex", gap: 2, alignItems: "flex-end", height: 150 }}>
                  <div style={{ flex: 1, background: "#059669", borderRadius: "3px 3px 0 0", height: `${(d.encaisse / maxVal) * 100}%`, minHeight: d.encaisse > 0 ? 4 : 0, transition: "height 0.3s" }} title={`${d.encaisse.toLocaleString("fr-FR")} €`} />
                  <div style={{ flex: 1, background: "#6366F1", borderRadius: "3px 3px 0 0", height: `${(d.appele / maxVal) * 100}%`, minHeight: d.appele > 0 ? 4 : 0, transition: "height 0.3s" }} title={`${d.appele.toLocaleString("fr-FR")} €`} />
                </div>
                <div style={{ fontSize: 10, color: "#9ca3af", fontWeight: 500 }}>{d.mois}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
