"use client";
import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";

const GOLD = "#B8966A";

const ODS_STATUS: Record<string, { label: string; color: string }> = {
  brouillon:  { label: "Brouillon",  color: "#6b7280" },
  "envoyé":   { label: "Envoyé",     color: "#2563EB" },
  "accepté":  { label: "Accepté",    color: "#059669" },
  en_cours:   { label: "En cours",   color: "#d97706" },
  "terminé":  { label: "Terminé",    color: "#10b981" },
  "annulé":   { label: "Annulé",     color: "#dc2626" },
};

interface ODS {
  id: string; ref: string; supplierId: string; title: string; description?: string;
  address?: string; deadline?: string; amount?: number; status: string; notes?: string;
  createdAt: string;
  supplier?: { name: string; type: string; phone?: string; email?: string };
}

export default function ODSPage() {
  const [orders, setOrders]     = useState<ODS[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filterStatus, setFilter] = useState("all");

  async function load() {
    setLoading(true);
    const r = await fetch("/api/ods");
    if (r.ok) setOrders(await r.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function updateStatus(id: string, status: string) {
    const r = await fetch(`/api/ods/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (r.ok) setOrders(p => p.map(o => o.id === id ? { ...o, status } : o));
  }

  const filtered = filterStatus === "all" ? orders : orders.filter(o => o.status === filterStatus);
  const countByStatus = (s: string) => orders.filter(o => o.status === s).length;

  return (
    <div style={{ display: "flex", height: "100vh", background: "#f9fafb", fontFamily: "'Inter', sans-serif" }}>
      <Sidebar active="ods" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "14px 24px" }}>
          <h1 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: 0 }}>📋 Ordres de service</h1>
          <p style={{ fontSize: 12, color: "#6b7280", margin: "2px 0 0" }}>{orders.length} ordre(s) au total</p>
        </div>

        {/* Filtres */}
        <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "8px 24px", display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Pill label="Tous" count={orders.length} active={filterStatus === "all"} onClick={() => setFilter("all")} />
          {Object.entries(ODS_STATUS).map(([v, s]) => {
            const c = countByStatus(v);
            return c > 0 ? <Pill key={v} label={s.label} count={c} active={filterStatus === v} color={s.color} onClick={() => setFilter(v)} /> : null;
          })}
        </div>

        {/* Liste */}
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 60, color: "#9ca3af" }}>Chargement…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, color: "#9ca3af" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
              <div style={{ fontWeight: 600, color: "#374151" }}>Aucun ordre de service</div>
              <div style={{ fontSize: 13, marginTop: 6 }}>Créez des ODS depuis le détail d'une tâche</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filtered.map(o => {
                const st = ODS_STATUS[o.status] ?? { label: o.status, color: "#6b7280" };
                return (
                  <div key={o.id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px 16px", display: "flex", gap: 14, alignItems: "flex-start" }}>
                    <div style={{ paddingTop: 2 }}>
                      <div style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: GOLD, background: "#F7F0E6", padding: "2px 8px", borderRadius: 5 }}>{o.ref}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontWeight: 600, fontSize: 14, color: "#111827" }}>{o.title}</span>
                        <span style={{ background: st.color + "20", color: st.color, borderRadius: 5, padding: "1px 7px", fontSize: 11, fontWeight: 600 }}>{st.label}</span>
                      </div>
                      {o.supplier && <div style={{ fontSize: 12, color: "#6b7280" }}>🔧 {o.supplier.name}{o.supplier.phone && ` · ${o.supplier.phone}`}</div>}
                      <div style={{ display: "flex", gap: 12, marginTop: 4, fontSize: 11, color: "#9ca3af" }}>
                        {o.address  && <span>📍 {o.address}</span>}
                        {o.deadline && <span>📅 {new Date(o.deadline).toLocaleDateString("fr-FR")}</span>}
                        {o.amount   && <span style={{ color: "#059669" }}>💶 {o.amount.toLocaleString("fr-FR")} €</span>}
                        <span>Créé le {new Date(o.createdAt).toLocaleDateString("fr-FR")}</span>
                      </div>
                      {o.description && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6, lineHeight: 1.4 }}>{o.description}</div>}
                    </div>
                    <select value={o.status} onChange={e => updateStatus(o.id, e.target.value)} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "5px 8px", fontSize: 12, background: "#f9fafb", outline: "none", cursor: "pointer", flexShrink: 0 }}>
                      {Object.entries(ODS_STATUS).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
                    </select>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Pill({ label, count, active, color, onClick }: { label: string; count: number; active: boolean; color?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ background: active ? (color || GOLD) : "#f3f4f6", color: active ? "#fff" : (color || "#374151"), border: "none", borderRadius: 20, padding: "4px 12px", fontSize: 12, cursor: "pointer", fontWeight: active ? 600 : 400 }}>
      {label} <span style={{ opacity: 0.7 }}>({count})</span>
    </button>
  );
}
