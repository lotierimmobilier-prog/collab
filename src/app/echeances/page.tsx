"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import Sidebar from "@/components/Sidebar";

const GOLD = "#B8966A"; const DARK = "#1C1A17"; const BORDER = "#E6E1D9"; const GOLD_BG = "#F7F0E6";
const RED = "#DC2626"; const AMBER = "#B45309"; const GREEN = "#2F855A";

type Status = "ok" | "soon" | "expired" | "none";
interface Echeance { id: string; category: string; label: string; who?: string; date: string; daysLeft: number; status: Status; link: string }

const STATUS_UI: Record<Status, { label: string; color: string }> = {
  expired: { label: "Expiré", color: RED },
  soon:    { label: "Bientôt", color: AMBER },
  ok:      { label: "À jour", color: GREEN },
  none:    { label: "—", color: "#9ca3af" },
};
const CAT: Record<string, { label: string; icon: string }> = {
  perso:            { label: "Personnel",       icon: "👤" },
  fournisseur:      { label: "Fournisseur",     icon: "🔧" },
  carte_pro:        { label: "Carte pro",       icon: "🪪" },
  assurance_agence: { label: "Assurance agence", icon: "🛡" },
  vehicule:         { label: "Véhicule",        icon: "🚗" },
  local:            { label: "Local",           icon: "🏢" },
};

export default function EcheancesPage() {
  const [items, setItems] = useState<Echeance[]>([]);
  const [counts, setCounts] = useState<{ expired: number; soon: number; total: number }>({ expired: 0, soon: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"all" | "expired" | "soon" | "90">("all");
  const [catFilter, setCatFilter] = useState<string>("all");

  useEffect(() => { (async () => {
    const r = await fetch("/api/echeances");
    if (r.ok) { const d = await r.json(); setItems(d.items); setCounts(d.counts); }
    setLoading(false);
  })(); }, []);

  const cats = [...new Set(items.map(i => i.category))];
  const filtered = items.filter(i => {
    const ms = statusFilter === "all" ? true
      : statusFilter === "expired" ? i.status === "expired"
      : statusFilter === "soon" ? i.status === "soon"
      : i.daysLeft <= 90; // « 90 »
    const mc = catFilter === "all" || i.category === catFilter;
    return ms && mc;
  });

  function fmtDays(d: number) {
    if (d < 0) return `il y a ${Math.abs(d)} j`;
    if (d === 0) return "aujourd'hui";
    return `dans ${d} j`;
  }

  return (
    <div style={{ display: "flex", height: "100vh", background: "#f9fafb", fontFamily: "'Inter', sans-serif" }}>
      <Sidebar active="echeances" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ background: "#fff", borderBottom: `1px solid ${BORDER}`, padding: "14px 24px" }}>
          <h1 style={{ fontSize: 16, fontWeight: 700, color: DARK, margin: 0 }}>⏰ Centre des échéances</h1>
          <p style={{ fontSize: 12, color: "#6b7280", margin: "2px 0 0" }}>
            Toutes vos dates de validité au même endroit{counts.expired > 0 ? ` — ${counts.expired} expirée(s)` : ""}{counts.soon > 0 ? `, ${counts.soon} à renouveler` : ""}.
          </p>
        </div>

        {/* Filtres statut */}
        <div style={{ background: "#fff", borderBottom: `1px solid ${BORDER}`, padding: "8px 24px", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <Seg label="Tout" active={statusFilter === "all"} onClick={() => setStatusFilter("all")} count={items.length} />
          <Seg label="Expirées" active={statusFilter === "expired"} onClick={() => setStatusFilter("expired")} count={counts.expired} color={RED} />
          <Seg label="À renouveler" active={statusFilter === "soon"} onClick={() => setStatusFilter("soon")} count={counts.soon} color={AMBER} />
          <Seg label="≤ 90 jours" active={statusFilter === "90"} onClick={() => setStatusFilter("90")} />
          <div style={{ width: 1, height: 22, background: BORDER, margin: "0 4px" }} />
          <Seg label="Toutes catégories" active={catFilter === "all"} onClick={() => setCatFilter("all")} />
          {cats.map(c => <Seg key={c} label={`${CAT[c]?.icon ?? ""} ${CAT[c]?.label ?? c}`} active={catFilter === c} onClick={() => setCatFilter(c)} />)}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          {loading ? <div style={{ textAlign: "center", color: "#9ca3af", padding: 60 }}>Chargement…</div>
           : filtered.length === 0 ? (
            <div style={{ textAlign: "center", color: "#9ca3af", padding: 60 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
              <div style={{ fontWeight: 600, color: "#374151" }}>Aucune échéance ici</div>
              <div style={{ fontSize: 13, marginTop: 6 }}>Rien à renouveler pour ce filtre.</div>
            </div>
          ) : (
            <div style={{ maxWidth: 900, display: "flex", flexDirection: "column", gap: 8 }}>
              {filtered.map(i => {
                const su = STATUS_UI[i.status]; const cat = CAT[i.category] ?? { label: i.category, icon: "•" };
                return (
                  <Link key={i.id} href={i.link} style={{ textDecoration: "none" }}>
                    <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderLeft: `4px solid ${su.color}`, borderRadius: 10, padding: "11px 14px", display: "flex", gap: 12, alignItems: "center" }}>
                      <div style={{ fontSize: 20, width: 26, textAlign: "center" }}>{cat.icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: DARK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{i.label}</div>
                        <div style={{ fontSize: 11.5, color: "#9ca3af", display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <span>{cat.label}</span>{i.who && <span>· {i.who}</span>}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: su.color }}>{new Date(i.date).toLocaleDateString("fr-FR")}</div>
                        <div style={{ fontSize: 11, color: "#9ca3af" }}>{fmtDays(i.daysLeft)}</div>
                      </div>
                      <span style={{ background: su.color + "20", color: su.color, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600, flexShrink: 0 }}>{su.label}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Seg({ label, active, onClick, count, color }: { label: string; active: boolean; onClick: () => void; count?: number; color?: string }) {
  return (
    <button onClick={onClick} style={{ background: active ? (color || GOLD) : "#f3f4f6", color: active ? "#fff" : (color || "#374151"), border: "none", borderRadius: 20, padding: "4px 12px", fontSize: 12, cursor: "pointer", fontWeight: active ? 600 : 400 }}>
      {label}{count != null && count > 0 ? <span style={{ opacity: 0.8 }}> ({count})</span> : ""}
    </button>
  );
}
void GOLD_BG;
