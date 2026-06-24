"use client";
import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";
import Link from "next/link";

const GOLD = "#B8966A";

interface KPI { label: string; value: string | number; sub?: string; icon: string; color?: string; }
interface RecentBail { id: string; reference: string; status: string; monthlyRent: number; charges: number; lot?: { address: string; label?: string }; tenants?: { tenant: { prenom: string; nom: string } }[]; }

const BAIL_STATUS: Record<string, { label: string; color: string }> = {
  active:     { label: "Actif",      color: "#059669" },
  pending:    { label: "En attente", color: "#d97706" },
  suspended:  { label: "Suspendu",   color: "#6b7280" },
  terminated: { label: "Résilié",    color: "#dc2626" },
};

export default function GestionLocativePage() {
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [recentBaux, setRecentBaux] = useState<RecentBail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [lr, br, or, tr] = await Promise.all([
        fetch("/api/lots"),
        fetch("/api/baux"),
        fetch("/api/proprietaires"),
        fetch("/api/locataires"),
      ]);
      const lots      = lr.ok ? await lr.json() : [];
      const baux      = br.ok ? await br.json() : [];
      const owners    = or.ok ? await or.json() : [];
      const tenants   = tr.ok ? await tr.json() : [];

      const activeBaux = baux.filter((b: RecentBail) => b.status === "active");
      const loyerTotal = activeBaux.reduce((s: number, b: RecentBail) => s + b.monthlyRent + b.charges, 0);
      const vacants    = lots.filter((l: { status: string }) => l.status === "vacant").length;

      setKpis([
        { icon: "👤", label: "Propriétaires",   value: owners.length,        sub: "mandants" },
        { icon: "🏡", label: "Biens",            value: lots.length,          sub: `${vacants} vacant(s)` },
        { icon: "👥", label: "Locataires",       value: tenants.length,       sub: "dossiers actifs" },
        { icon: "📄", label: "Baux actifs",      value: activeBaux.length,    sub: `sur ${baux.length} total` },
        { icon: "💶", label: "Loyers / mois",    value: `${loyerTotal.toLocaleString("fr-FR")} €`, sub: "CC total", color: "#059669" },
      ]);
      setRecentBaux(baux.slice(0, 8));
      setLoading(false);
    }
    load();
  }, []);

  const modules = [
    { icon: "👤", label: "Propriétaires",  desc: "Mandants, coordonnées, RIB",     href: "/proprietaires",  color: "#7c3aed" },
    { icon: "🏡", label: "Biens",          desc: "Parc immobilier, caractéristiques", href: "/biens",        color: "#0891b2" },
    { icon: "👥", label: "Locataires",     desc: "Dossiers, cautions, contacts",    href: "/locataires",     color: "#059669" },
    { icon: "📄", label: "Baux",           desc: "Contrats, révisions, résiliations", href: "/baux",         color: GOLD },
    { icon: "⌂",  label: "États des lieux",desc: "EDL entrant/sortant",             href: "/etats-des-lieux",color: "#d97706" },
    { icon: "📋", label: "Ordres de service",desc: "Travaux, fournisseurs",           href: "/ordres-de-service", color: "#dc2626" },
  ];

  return (
    <div style={{ display: "flex", height: "100vh", background: "#f9fafb", fontFamily: "'Inter', sans-serif" }}>
      <Sidebar active="gestion-loc" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "14px 24px" }}>
          <h1 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: 0 }}>🏠 Gestion locative</h1>
          <p style={{ fontSize: 12, color: "#6b7280", margin: 0, marginTop: 2 }}>Tableau de bord du parc locatif</p>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 60, color: "#9ca3af" }}>Chargement…</div>
          ) : (
            <>
              {/* KPIs */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                {kpis.map((k, i) => (
                  <div key={i} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "16px 18px" }}>
                    <div style={{ fontSize: 24, marginBottom: 8 }}>{k.icon}</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: k.color ?? "#111827" }}>{k.value}</div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{k.label}</div>
                    {k.sub && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{k.sub}</div>}
                  </div>
                ))}
              </div>

              {/* Modules */}
              <div>
                <h2 style={{ fontSize: 13, fontWeight: 700, color: "#374151", margin: "0 0 12px" }}>Modules</h2>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 }}>
                  {modules.map(m => (
                    <Link key={m.href} href={m.href} style={{ textDecoration: "none" }}>
                      <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px 16px", cursor: "pointer", transition: "box-shadow 0.15s" }}
                        onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)")}
                        onMouseLeave={e => (e.currentTarget.style.boxShadow = "none")}
                      >
                        <div style={{ width: 36, height: 36, borderRadius: 8, background: m.color + "15", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, marginBottom: 8 }}>{m.icon}</div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: "#111827" }}>{m.label}</div>
                        <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 3 }}>{m.desc}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              {/* Baux récents */}
              {recentBaux.length > 0 && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <h2 style={{ fontSize: 13, fontWeight: 700, color: "#374151", margin: 0 }}>Baux récents</h2>
                    <Link href="/baux" style={{ fontSize: 12, color: GOLD, textDecoration: "none" }}>Voir tous →</Link>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {recentBaux.map(b => {
                      const st = BAIL_STATUS[b.status] ?? { label: b.status, color: "#6b7280" };
                      return (
                        <div key={b.id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 10, padding: "10px 14px", display: "flex", gap: 12, alignItems: "center" }}>
                          <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: GOLD, background: "#F7F0E6", padding: "1px 6px", borderRadius: 4 }}>{b.reference}</span>
                          <span style={{ flex: 1, fontSize: 13, color: "#374151" }}>{b.lot?.label || b.lot?.address}</span>
                          <span style={{ fontSize: 12, color: "#6b7280" }}>{b.tenants?.map(bt => `${bt.tenant.prenom} ${bt.tenant.nom}`).join(", ")}</span>
                          <span style={{ background: st.color + "20", color: st.color, borderRadius: 5, padding: "1px 7px", fontSize: 11, fontWeight: 600 }}>{st.label}</span>
                          <span style={{ fontWeight: 700, fontSize: 13, color: "#059669" }}>{(b.monthlyRent + b.charges).toLocaleString("fr-FR")} €</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
