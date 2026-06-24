"use client";
import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";

const GOLD = "#B8966A";

const LOT_TYPES = [
  { value: "apartment", label: "Appartement", icon: "🏢" },
  { value: "house",     label: "Maison",      icon: "🏠" },
  { value: "commercial",label: "Commercial",  icon: "🏪" },
  { value: "parking",   label: "Parking",     icon: "🅿️" },
  { value: "storage",   label: "Cave/Grenier",icon: "📦" },
];

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  vacant:     { label: "Vacant",     color: "#6b7280" },
  occupied:   { label: "Occupé",     color: "#059669" },
  under_work: { label: "En travaux", color: "#d97706" },
};

function typeInfo(v: string) { return LOT_TYPES.find(t => t.value === v) ?? { icon: "🏢", label: v }; }

interface Owner { id: string; prenom: string; nom: string; companyName?: string; }
interface Bail  { monthlyRent: number; charges: number; }
interface Lot {
  id: string; reference: string; label?: string; address: string;
  lotType: string; surface?: number; rooms?: number; floor?: number;
  status: string; ownerId?: string; notes?: string;
  owner?: Owner; baux?: Bail[];
}

export default function BiensPage() {
  const [lots, setLots]       = useState<Lot[]>([]);
  const [owners, setOwners]   = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Lot | null>(null);
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch]   = useState("");

  async function load() {
    setLoading(true);
    const [lr, or] = await Promise.all([fetch("/api/lots"), fetch("/api/proprietaires")]);
    if (lr.ok) setLots(await lr.json());
    if (or.ok) setOwners(await or.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function save(data: Partial<Lot>) {
    const isEdit = !!data.id;
    const r = await fetch(isEdit ? `/api/lots/${data.id}` : "/api/lots", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (r.ok) { await load(); setShowForm(false); setEditing(null); }
  }

  async function del(id: string) {
    if (!confirm("Supprimer ce bien ?")) return;
    await fetch(`/api/lots/${id}`, { method: "DELETE" });
    await load();
  }

  const filtered = lots.filter(l => {
    const matchType   = filterType   === "all" || l.lotType === filterType;
    const matchStatus = filterStatus === "all" || l.status === filterStatus;
    const matchSearch = !search || `${l.reference} ${l.address} ${l.label ?? ""}`.toLowerCase().includes(search.toLowerCase());
    return matchType && matchStatus && matchSearch;
  });

  const countByStatus = (s: string) => lots.filter(l => l.status === s).length;

  return (
    <div style={{ display: "flex", height: "100vh", background: "#f9fafb", fontFamily: "'Inter', sans-serif" }}>
      <Sidebar active="biens" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "14px 24px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: 0 }}>🏡 Biens immobiliers</h1>
            <p style={{ fontSize: 12, color: "#6b7280", margin: 0, marginTop: 2 }}>
              {lots.length} bien(s) · {countByStatus("occupied")} occupé(s) · {countByStatus("vacant")} vacant(s)
            </p>
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…"
            style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 12px", fontSize: 13, outline: "none", width: 200, background: "#f9fafb" }} />
          <button onClick={() => { setEditing(null); setShowForm(true); }} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
            + Ajouter bien
          </button>
        </div>

        <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "8px 24px", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <Pill label="Tous" active={filterType === "all"} count={lots.length} onClick={() => setFilterType("all")} />
          {LOT_TYPES.map(t => {
            const c = lots.filter(l => l.lotType === t.value).length;
            return c > 0 ? <Pill key={t.value} label={`${t.icon} ${t.label}`} active={filterType === t.value} count={c} onClick={() => setFilterType(t.value)} /> : null;
          })}
          <div style={{ width: 1, height: 20, background: "#e5e7eb", margin: "0 4px" }} />
          {(["all", "vacant", "occupied", "under_work"] as const).map(s => {
            const info = s === "all" ? { label: "Tous statuts", color: "#6b7280" } : STATUS_MAP[s];
            const c = s === "all" ? lots.length : countByStatus(s);
            return <Pill key={s} label={info.label} active={filterStatus === s} count={c} color={info.color} onClick={() => setFilterStatus(s)} />;
          })}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 60, color: "#9ca3af" }}>Chargement…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, color: "#9ca3af" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🏡</div>
              <div style={{ fontWeight: 600, color: "#374151" }}>Aucun bien</div>
              <div style={{ fontSize: 13, marginTop: 6 }}>Ajoutez vos biens immobiliers en gestion</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 }}>
              {filtered.map(l => {
                const ti  = typeInfo(l.lotType);
                const st  = STATUS_MAP[l.status] ?? { label: l.status, color: "#6b7280" };
                const activeBaux = l.baux ?? [];
                const loyer = activeBaux.reduce((s, b) => s + b.monthlyRent + b.charges, 0);
                return (
                  <div key={l.id} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <div style={{ width: 44, height: 44, borderRadius: 10, background: "#F7F0E6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{ti.icon}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                          <span style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: GOLD, background: "#F7F0E6", padding: "1px 6px", borderRadius: 4 }}>{l.reference}</span>
                          <span style={{ background: st.color + "20", color: st.color, borderRadius: 5, padding: "1px 7px", fontSize: 11, fontWeight: 600 }}>{st.label}</span>
                        </div>
                        <div style={{ fontWeight: 600, fontSize: 14, color: "#111827", marginTop: 3 }}>{l.label || l.address}</div>
                        {l.label && <div style={{ fontSize: 12, color: "#6b7280" }}>📍 {l.address}</div>}
                      </div>
                      <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                        <button onClick={() => { setEditing(l); setShowForm(true); }} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer", background: "#fff" }}>✏</button>
                        <button onClick={() => del(l.id)} style={{ border: "1px solid #fecaca", borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer", color: "#dc2626", background: "#fff" }}>✕</button>
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: 10, fontSize: 12, color: "#6b7280", flexWrap: "wrap" }}>
                      {l.surface && <span>📐 {l.surface} m²</span>}
                      {l.rooms   && <span>🚪 {l.rooms} pièce(s)</span>}
                      {l.floor !== undefined && l.floor !== null && <span>🏢 Étage {l.floor}</span>}
                      {l.owner   && <span>👤 {l.owner.prenom} {l.owner.nom}{l.owner.companyName ? ` (${l.owner.companyName})` : ""}</span>}
                    </div>

                    {loyer > 0 && (
                      <div style={{ background: "#f0fdf4", borderRadius: 8, padding: "6px 10px", display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                        <span style={{ color: "#6b7280" }}>Loyer CC</span>
                        <span style={{ fontWeight: 700, color: "#059669" }}>{loyer.toLocaleString("fr-FR")} € / mois</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <LotForm lot={editing} owners={owners} onSave={save} onClose={() => { setShowForm(false); setEditing(null); }} />
      )}
    </div>
  );
}

function LotForm({ lot, owners, onSave, onClose }: { lot: Lot | null; owners: Owner[]; onSave: (d: Partial<Lot>) => void; onClose: () => void }) {
  const [f, setF] = useState({
    reference: lot?.reference ?? "",
    label: lot?.label ?? "",
    address: lot?.address ?? "",
    lotType: lot?.lotType ?? "apartment",
    surface: lot?.surface !== undefined ? String(lot.surface) : "",
    rooms: lot?.rooms !== undefined ? String(lot.rooms) : "",
    floor: lot?.floor !== undefined && lot.floor !== null ? String(lot.floor) : "",
    status: lot?.status ?? "vacant",
    ownerId: lot?.ownerId ?? "",
    notes: lot?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  function set(k: string, v: string) { setF(p => ({ ...p, [k]: v })); }

  async function submit() {
    if (!f.address.trim()) return;
    setSaving(true);
    await onSave({
      id: lot?.id,
      reference: f.reference,
      label: f.label,
      address: f.address,
      lotType: f.lotType,
      surface: f.surface ? parseFloat(f.surface) : undefined,
      rooms: f.rooms ? parseInt(f.rooms) : undefined,
      floor: f.floor !== "" ? parseInt(f.floor) : undefined,
      status: f.status,
      ownerId: f.ownerId || undefined,
      notes: f.notes,
    });
    setSaving(false);
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 40 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 580, maxWidth: "95vw", maxHeight: "90vh", background: "#fff", zIndex: 50, display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", borderRadius: 16 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{lot ? "Modifier le bien" : "Nouveau bien"}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer" }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <F label="Type de bien">
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {LOT_TYPES.map(t => (
                <button key={t.value} onClick={() => set("lotType", t.value)} style={{ padding: "6px 10px", fontSize: 11, borderRadius: 20, cursor: "pointer", border: `1px solid ${f.lotType === t.value ? GOLD : "#e5e7eb"}`, background: f.lotType === t.value ? "#F7F0E6" : "#fff", color: f.lotType === t.value ? GOLD : "#374151" }}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </F>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <F label="Référence"><input value={f.reference} onChange={e => set("reference", e.target.value)} style={inp} placeholder="Générée auto si vide" /></F>
            <F label="Nom/Label"><input autoFocus value={f.label} onChange={e => set("label", e.target.value)} style={inp} placeholder="Appt 3ème gauche…" /></F>
          </div>

          <F label="Adresse *"><input value={f.address} onChange={e => set("address", e.target.value)} style={inp} placeholder="12 rue des Lilas, 31000 Toulouse" /></F>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <F label="Surface (m²)"><input value={f.surface} onChange={e => set("surface", e.target.value)} style={inp} type="number" placeholder="45" /></F>
            <F label="Pièces"><input value={f.rooms} onChange={e => set("rooms", e.target.value)} style={inp} type="number" placeholder="3" /></F>
            <F label="Étage"><input value={f.floor} onChange={e => set("floor", e.target.value)} style={inp} type="number" placeholder="2" /></F>
          </div>

          <F label="Statut">
            <div style={{ display: "flex", gap: 8 }}>
              {Object.entries(STATUS_MAP).map(([v, s]) => (
                <button key={v} onClick={() => set("status", v)} style={{ flex: 1, padding: "7px 4px", fontSize: 12, borderRadius: 8, cursor: "pointer", border: `1px solid ${f.status === v ? s.color : "#e5e7eb"}`, background: f.status === v ? s.color + "20" : "#fff", color: f.status === v ? s.color : "#374151", fontWeight: f.status === v ? 600 : 400 }}>
                  {s.label}
                </button>
              ))}
            </div>
          </F>

          <F label="Propriétaire">
            <select value={f.ownerId} onChange={e => set("ownerId", e.target.value)} style={{ ...inp, cursor: "pointer" }}>
              <option value="">— Aucun propriétaire —</option>
              {owners.map(o => <option key={o.id} value={o.id}>{o.prenom} {o.nom}{o.companyName ? ` (${o.companyName})` : ""}</option>)}
            </select>
          </F>

          <F label="Notes">
            <textarea value={f.notes} onChange={e => set("notes", e.target.value)} rows={3} style={{ ...inp, height: "auto", padding: "8px 10px", resize: "none" }} />
          </F>
        </div>

        <div style={{ padding: "14px 20px", borderTop: "1px solid #e5e7eb", display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>Annuler</button>
          <button onClick={submit} disabled={!f.address.trim() || saving} style={{ background: f.address.trim() && !saving ? GOLD : "#e5e7eb", color: f.address.trim() && !saving ? "#fff" : "#9ca3af", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
            {saving ? "Enregistrement…" : lot ? "Enregistrer" : "Créer"}
          </button>
        </div>
      </div>
    </>
  );
}

function Pill({ label, active, count, color, onClick }: { label: string; active: boolean; count: number; color?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ background: active ? (color ?? GOLD) : "#f3f4f6", color: active ? "#fff" : (color ?? "#374151"), border: "none", borderRadius: 20, padding: "4px 12px", fontSize: 12, cursor: "pointer", fontWeight: active ? 600 : 400 }}>
      {label} <span style={{ opacity: 0.7 }}>({count})</span>
    </button>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 5 }}>{label}</div>{children}</div>;
}
const inp: React.CSSProperties = { width: "100%", height: 36, border: "1px solid #e5e7eb", borderRadius: 8, padding: "0 10px", fontSize: 13, outline: "none", background: "#f9fafb", fontFamily: "inherit", boxSizing: "border-box" };
