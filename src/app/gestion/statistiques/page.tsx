"use client";
import { useEffect, useState } from "react";

const GOLD = "#B8966A"; const GOLD_BG = "#F7F0E6"; const BORDER = "#E6E1D9";

export default function StatistiquesPage() {
  const [data, setData] = useState<{ owners: number; tenants: number; lots: number; occupied: number; baux: number; totalRent: number; totalEnc: number; totalDep: number } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/proprietaires").then(r => r.json()),
      fetch("/api/tenants").then(r => r.json()),
      fetch("/api/lots").then(r => r.json()),
      fetch("/api/baux").then(r => r.json()),
      fetch("/api/encaissements").then(r => r.json()),
      fetch("/api/depots-garantie").then(r => r.json()),
    ]).then(([owners, tenants, lots, baux, encs, depots]) => {
      const activeBaux = baux.filter((b: { status: string; monthlyRent: number; charges: number }) => b.status === "active");
      setData({
        owners: owners.length,
        tenants: tenants.length,
        lots: lots.length,
        occupied: lots.filter((l: { status: string }) => l.status === "occupied").length,
        baux: activeBaux.length,
        totalRent: activeBaux.reduce((s: number, b: { monthlyRent: number; charges: number }) => s + b.monthlyRent + b.charges, 0),
        totalEnc: encs.reduce((s: number, e: { montant: number }) => s + e.montant, 0),
        totalDep: depots.filter((d: { status: string }) => d.status === "conserve").reduce((s: number, d: { montant: number }) => s + d.montant, 0),
      });
    });
  }, []);

  const txOccup = data && data.lots > 0 ? Math.round((data.occupied / data.lots) * 100) : 0;

  const kpis = [
    { label: "Propriétaires", value: data?.owners ?? "—", color: "#7C3AED", bg: "#F5F3FF" },
    { label: "Locataires actifs", value: data?.tenants ?? "—", color: "#2563EB", bg: "#EFF6FF" },
    { label: "Lots total", value: data?.lots ?? "—", color: "#374151", bg: "#F9FAFB" },
    { label: "Taux d'occupation", value: data ? `${txOccup}%` : "—", color: txOccup >= 80 ? "#059669" : "#D97706", bg: txOccup >= 80 ? "#F0FDF4" : "#FFFBEB" },
    { label: "Baux actifs", value: data?.baux ?? "—", color: GOLD, bg: GOLD_BG },
    { label: "Loyers / mois", value: data ? `${data.totalRent.toLocaleString("fr-FR")} €` : "—", color: GOLD, bg: GOLD_BG },
    { label: "Total encaissé", value: data ? `${data.totalEnc.toLocaleString("fr-FR")} €` : "—", color: "#059669", bg: "#F0FDF4" },
    { label: "Dépôts conservés", value: data ? `${data.totalDep.toLocaleString("fr-FR")} €` : "—", color: "#6366F1", bg: "#EEF2FF" },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1C1A17", marginBottom: 6 }}>Statistiques</h1>
      <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 24 }}>Indicateurs clés du portefeuille</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ background: k.bg, borderRadius: 12, padding: "18px 20px", border: `1px solid ${BORDER}` }}>
            <div style={{ fontSize: 26, fontWeight: 700, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4, fontWeight: 500 }}>{k.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
