"use client";
import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";

const GOLD = "#B8966A";

const BAIL_STATUS: Record<string, { label: string; color: string }> = {
  active:     { label: "Actif",    color: "#059669" },
  pending:    { label: "En attente", color: "#d97706" },
  suspended:  { label: "Suspendu", color: "#6b7280" },
  terminated: { label: "Résilié", color: "#dc2626" },
};

const LEASE_TYPES = [
  { value: "residential", label: "Habitation", icon: "🏠" },
  { value: "commercial",  label: "Commercial",  icon: "🏪" },
  { value: "mixed",       label: "Mixte",       icon: "🏢" },
];

interface Lot    { id: string; reference: string; address: string; label?: string; }
interface Tenant { id: string; prenom: string; nom: string; email?: string; phone?: string; }
interface BailTenant { tenant: Tenant; }
interface Bail {
  id: string; reference: string; lotId: string; leaseType: string;
  startDate: string; endDate?: string; monthlyRent: number; charges: number;
  deposit?: number; status: string; renewalType: string;
  lot?: Lot; tenants?: BailTenant[];
}

export default function BauxPage() {
  const [baux, setBaux]       = useState<Bail[]>([]);
  const [lots, setLots]       = useState<Lot[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");

  async function load() {
    setLoading(true);
    const [br, lr, tr] = await Promise.all([fetch("/api/baux"), fetch("/api/lots"), fetch("/api/locataires")]);
    if (br.ok) setBaux(await br.json());
    if (lr.ok) setLots(await lr.json());
    if (tr.ok) setTenants(await tr.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function save(data: Record<string, unknown>) {
    const r = await fetch("/api/baux", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (r.ok) { await load(); setShowForm(false); }
  }

  async function updateStatus(id: string, status: string) {
    const r = await fetch(`/api/baux/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (r.ok) setBaux(p => p.map(b => b.id === id ? { ...b, status } : b));
  }

  const filtered = filterStatus === "all" ? baux : baux.filter(b => b.status === filterStatus);
  const countByStatus = (s: string) => baux.filter(b => b.status === s).length;

  return (
    <div style={{ display: "flex", height: "100vh", background: "#f9fafb", fontFamily: "'Inter', sans-serif" }}>
      <Sidebar active="baux" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "14px 24px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: 0 }}>📄 Baux</h1>
            <p style={{ fontSize: 12, color: "#6b7280", margin: 0, marginTop: 2 }}>
              {baux.length} bail/baux · {countByStatus("active")} actif(s)
            </p>
          </div>
          <button onClick={() => setShowForm(true)} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
            + Nouveau bail
          </button>
        </div>

        <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "8px 24px", display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Pill label="Tous" count={baux.length} active={filterStatus === "all"} onClick={() => setFilterStatus("all")} />
          {Object.entries(BAIL_STATUS).map(([v, s]) => {
            const c = countByStatus(v);
            return c > 0 ? <Pill key={v} label={s.label} count={c} active={filterStatus === v} color={s.color} onClick={() => setFilterStatus(v)} /> : null;
          })}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 60, color: "#9ca3af" }}>Chargement…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, color: "#9ca3af" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
              <div style={{ fontWeight: 600, color: "#374151" }}>Aucun bail</div>
              <div style={{ fontSize: 13, marginTop: 6 }}>Créez le premier contrat de location</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filtered.map(b => {
                const st = BAIL_STATUS[b.status] ?? { label: b.status, color: "#6b7280" };
                const lt = LEASE_TYPES.find(t => t.value === b.leaseType);
                const total = b.monthlyRent + b.charges;
                const ts = b.tenants?.map(bt => bt.tenant) ?? [];
                return (
                  <div key={b.id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px 16px", display: "flex", gap: 14, alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontFamily: "monospace", fontSize: 11, fontWeight: 700, color: GOLD, background: "#F7F0E6", padding: "2px 8px", borderRadius: 5, marginBottom: 4 }}>{b.reference}</div>
                      <span style={{ background: st.color + "20", color: st.color, borderRadius: 5, padding: "1px 7px", fontSize: 11, fontWeight: 600 }}>{st.label}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: "#111827", marginBottom: 4 }}>
                        {b.lot?.label || b.lot?.address || "Bien inconnu"}
                        {lt && <span style={{ marginLeft: 6, fontSize: 11, color: "#6b7280" }}>{lt.icon} {lt.label}</span>}
                      </div>
                      {ts.length > 0 && (
                        <div style={{ fontSize: 12, color: "#374151", marginBottom: 4 }}>
                          👥 {ts.map(t => `${t.prenom} ${t.nom}`).join(", ")}
                        </div>
                      )}
                      <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#9ca3af" }}>
                        <span>📅 Début : {new Date(b.startDate).toLocaleDateString("fr-FR")}</span>
                        {b.endDate && <span>→ {new Date(b.endDate).toLocaleDateString("fr-FR")}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 700, color: "#059669" }}>{total.toLocaleString("fr-FR")} € / mois</div>
                      <div style={{ fontSize: 11, color: "#9ca3af" }}>CC ({b.monthlyRent} + {b.charges} charges)</div>
                      {b.deposit && <div style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>Dépôt : {b.deposit.toLocaleString("fr-FR")} €</div>}
                    </div>
                    <select value={b.status} onChange={e => updateStatus(b.id, e.target.value)} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "5px 8px", fontSize: 12, background: "#f9fafb", outline: "none", cursor: "pointer", flexShrink: 0 }}>
                      {Object.entries(BAIL_STATUS).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
                    </select>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <BailForm lots={lots} tenants={tenants} onSave={save} onClose={() => setShowForm(false)} />
      )}
    </div>
  );
}

function BailForm({ lots, tenants, onSave, onClose }: { lots: Lot[]; tenants: Tenant[]; onSave: (d: Record<string, unknown>) => void; onClose: () => void }) {
  const [f, setF] = useState({
    lotId: "", leaseType: "residential", startDate: "", endDate: "",
    monthlyRent: "", charges: "0", deposit: "", renewalType: "tacit",
    status: "active", notes: "",
  });
  const [selectedTenants, setSelectedTenants] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  function set(k: string, v: string) { setF(p => ({ ...p, [k]: v })); }
  function toggleTenant(id: string) { setSelectedTenants(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]); }

  async function submit() {
    if (!f.lotId || !f.startDate || !f.monthlyRent) return;
    setSaving(true);
    await onSave({ ...f, tenantIds: selectedTenants });
    setSaving(false);
  }

  const ok = f.lotId && f.startDate && f.monthlyRent;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 40 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 580, maxWidth: "95vw", maxHeight: "90vh", background: "#fff", zIndex: 50, display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", borderRadius: 16 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Nouveau bail</span>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer" }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <F label="Type de bail">
            <div style={{ display: "flex", gap: 8 }}>
              {LEASE_TYPES.map(t => (
                <button key={t.value} onClick={() => set("leaseType", t.value)} style={{ flex: 1, padding: "7px 4px", fontSize: 12, borderRadius: 8, cursor: "pointer", border: `1px solid ${f.leaseType === t.value ? GOLD : "#e5e7eb"}`, background: f.leaseType === t.value ? "#F7F0E6" : "#fff", color: f.leaseType === t.value ? GOLD : "#374151" }}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </F>

          <F label="Bien *">
            <select value={f.lotId} onChange={e => set("lotId", e.target.value)} style={{ ...inp, cursor: "pointer" }}>
              <option value="">— Choisir un bien —</option>
              {lots.map(l => <option key={l.id} value={l.id}>{l.reference} · {l.label || l.address}</option>)}
            </select>
          </F>

          <F label="Locataire(s)">
            <div style={{ border: "1px solid #e5e7eb", borderRadius: 8, maxHeight: 160, overflowY: "auto" }}>
              {tenants.map(t => (
                <label key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 12px", cursor: "pointer", borderBottom: "1px solid #f9fafb" }}>
                  <input type="checkbox" checked={selectedTenants.includes(t.id)} onChange={() => toggleTenant(t.id)} />
                  <span style={{ fontSize: 13 }}>{t.prenom} {t.nom}</span>
                  {t.email && <span style={{ fontSize: 11, color: "#9ca3af" }}>{t.email}</span>}
                </label>
              ))}
              {tenants.length === 0 && <div style={{ padding: "10px 12px", fontSize: 12, color: "#9ca3af" }}>Aucun locataire enregistré</div>}
            </div>
          </F>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <F label="Date de début *"><input type="date" value={f.startDate} onChange={e => set("startDate", e.target.value)} style={inp} /></F>
            <F label="Date de fin"><input type="date" value={f.endDate} onChange={e => set("endDate", e.target.value)} style={inp} /></F>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <F label="Loyer HC (€) *"><input type="number" value={f.monthlyRent} onChange={e => set("monthlyRent", e.target.value)} style={inp} placeholder="600" /></F>
            <F label="Charges (€)"><input type="number" value={f.charges} onChange={e => set("charges", e.target.value)} style={inp} placeholder="50" /></F>
            <F label="Dépôt de garantie"><input type="number" value={f.deposit} onChange={e => set("deposit", e.target.value)} style={inp} placeholder="1200" /></F>
          </div>

          <F label="Renouvellement">
            <div style={{ display: "flex", gap: 8 }}>
              {[{ value: "tacit", label: "Reconduction tacite" }, { value: "fixed", label: "Durée fixe" }].map(r => (
                <button key={r.value} onClick={() => set("renewalType", r.value)} style={{ flex: 1, padding: "7px 4px", fontSize: 12, borderRadius: 8, cursor: "pointer", border: `1px solid ${f.renewalType === r.value ? GOLD : "#e5e7eb"}`, background: f.renewalType === r.value ? "#F7F0E6" : "#fff", color: f.renewalType === r.value ? GOLD : "#374151" }}>
                  {r.label}
                </button>
              ))}
            </div>
          </F>

          <F label="Notes">
            <textarea value={f.notes} onChange={e => set("notes", e.target.value)} rows={3} style={{ ...inp, height: "auto", padding: "8px 10px", resize: "none" }} />
          </F>
        </div>

        <div style={{ padding: "14px 20px", borderTop: "1px solid #e5e7eb", display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>Annuler</button>
          <button onClick={submit} disabled={!ok || saving} style={{ background: ok && !saving ? GOLD : "#e5e7eb", color: ok && !saving ? "#fff" : "#9ca3af", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
            {saving ? "Enregistrement…" : "Créer le bail"}
          </button>
        </div>
      </div>
    </>
  );
}

function Pill({ label, count, active, color, onClick }: { label: string; count: number; active: boolean; color?: string; onClick: () => void }) {
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
