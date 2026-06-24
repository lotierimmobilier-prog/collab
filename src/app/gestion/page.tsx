"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

const GOLD = "#B8966A";
const GOLD_BG = "#F7F0E6";

interface Stats { owners: number; tenants: number; lots: number; occupied: number; vacant: number; totalRent: number; activeBaux: number }

export default function GestionDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/proprietaires").then(r => r.json()),
      fetch("/api/lots").then(r => r.json()),
      fetch("/api/baux").then(r => r.json()),
      fetch("/api/tenants").then(r => r.json()),
    ]).then(([owners, lots, baux, tenants]) => {
      const occupied = (lots as { status: string }[]).filter(l => l.status === "occupied").length;
      const activeBaux = (baux as { status: string; monthlyRent: number; charges: number }[]).filter(b => b.status === "active");
      const totalRent = activeBaux.reduce((s, b) => s + (b.monthlyRent || 0) + (b.charges || 0), 0);
      setStats({ owners: owners.length, tenants: tenants.length, lots: lots.length, occupied, vacant: lots.length - occupied, totalRent, activeBaux: activeBaux.length });
    }).catch(() => {});
  }, []);

  const cards = [
    { label: "Propriétaires", value: stats?.owners, icon: "👤", href: "/gestion/proprietaires", color: "#7C3AED" },
    { label: "Locataires", value: stats?.tenants, icon: "🔑", href: "/gestion/locataires", color: "#2563EB" },
    { label: "Lots", value: stats?.lots, icon: "🏢", href: "/gestion/lots", color: "#059669" },
    { label: "Lots occupés", value: stats?.occupied, icon: "✅", href: "/gestion/lots", color: "#16A34A" },
    { label: "Lots vacants", value: stats?.vacant, icon: "⭕", href: "/gestion/lots", color: "#DC2626" },
    { label: "Baux actifs", value: stats?.activeBaux, icon: "📄", href: "/gestion/baux", color: GOLD },
  ];

  return (
    <div style={{ padding: 28 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1C1A17", marginBottom: 6 }}>Vue d'ensemble</h1>
      <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 28 }}>Tableau de bord de la gestion locative</p>

      {/* KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 14, marginBottom: 32 }}>
        {cards.map(c => (
          <Link key={c.label} href={c.href} style={{ textDecoration: "none" }}>
            <div style={{ background: "#fff", borderRadius: 12, padding: "18px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: "1px solid #E6E1D9", cursor: "pointer", transition: "transform 0.1s, box-shadow 0.1s" }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.06)"; }}
            >
              <div style={{ fontSize: 24, marginBottom: 8 }}>{c.icon}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: c.color, marginBottom: 2 }}>
                {stats ? c.value : "—"}
              </div>
              <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 500 }}>{c.label}</div>
            </div>
          </Link>
        ))}
        {/* Loyers */}
        <div style={{ background: GOLD_BG, borderRadius: 12, padding: "18px 20px", border: `1px solid ${GOLD}44` }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>💶</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: GOLD, marginBottom: 2 }}>
            {stats ? `${stats.totalRent.toLocaleString("fr-FR")} €` : "—"}
          </div>
          <div style={{ fontSize: 12, color: "#92400E", fontWeight: 500 }}>Loyers + charges / mois</div>
        </div>
      </div>

      {/* Accès rapides */}
      <h2 style={{ fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 12 }}>Accès rapides</h2>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {[
          { label: "+ Propriétaire", href: "/gestion/proprietaires?new=1" },
          { label: "+ Locataire", href: "/gestion/locataires?new=1" },
          { label: "+ Lot", href: "/gestion/lots?new=1" },
          { label: "+ Bail", href: "/gestion/baux?new=1" },
        ].map(b => (
          <Link key={b.label} href={b.href} style={{ textDecoration: "none", background: "#fff", border: "1px solid #E6E1D9", borderRadius: 8, padding: "8px 16px", fontSize: 13, color: "#374151", fontWeight: 500, cursor: "pointer" }}>
            {b.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
