"use client";
import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";

const GOLD = "#B8966A";

const OWNER_TYPES = [
  { value: "individual", label: "Particulier", icon: "👤" },
  { value: "sci",        label: "SCI",         icon: "🏢" },
  { value: "company",    label: "Société",      icon: "🏦" },
];

function typeInfo(v: string) { return OWNER_TYPES.find(t => t.value === v) ?? { icon: "👤", label: v }; }

interface Lot { id: string; reference: string; address: string; status: string; baux: { monthlyRent: number; charges: number }[]; }
interface Owner {
  id: string; prenom: string; nom: string; ownerType: string;
  email?: string; phone?: string; mobile?: string; companyName?: string; siret?: string;
  address?: string; iban?: string; bic?: string; bankName?: string; notes?: string;
  lots?: Lot[]; _count?: { lots: number };
}

export default function ProprietairesPage() {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Owner | null>(null);
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    const r = await fetch("/api/proprietaires");
    if (r.ok) setOwners(await r.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function save(data: Partial<Owner>) {
    const isEdit = !!data.id;
    const r = await fetch(isEdit ? `/api/proprietaires/${data.id}` : "/api/proprietaires", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (r.ok) { await load(); setShowForm(false); setEditing(null); }
  }

  async function del(id: string) {
    if (!confirm("Supprimer ce propriétaire ?")) return;
    await fetch(`/api/proprietaires/${id}`, { method: "DELETE" });
    await load();
  }

  const filtered = owners.filter(o =>
    !search || `${o.prenom} ${o.nom} ${o.companyName ?? ""} ${o.email ?? ""}`.toLowerCase().includes(search.toLowerCase())
  );

  const totalLots = owners.reduce((s, o) => s + (o._count?.lots ?? 0), 0);

  return (
    <div style={{ display: "flex", height: "100vh", background: "#f9fafb", fontFamily: "'Inter', sans-serif" }}>
      <Sidebar active="proprietaires" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "14px 24px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: 0 }}>👤 Propriétaires</h1>
            <p style={{ fontSize: 12, color: "#6b7280", margin: 0, marginTop: 2 }}>{owners.length} propriétaire(s) · {totalLots} bien(s)</p>
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…"
            style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 12px", fontSize: 13, outline: "none", width: 200, background: "#f9fafb" }} />
          <button onClick={() => { setEditing(null); setShowForm(true); }} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
            + Ajouter propriétaire
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 60, color: "#9ca3af" }}>Chargement…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, color: "#9ca3af" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>👤</div>
              <div style={{ fontWeight: 600, color: "#374151" }}>Aucun propriétaire</div>
              <div style={{ fontSize: 13, marginTop: 6 }}>Ajoutez vos propriétaires mandants</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filtered.map(o => {
                const ti = typeInfo(o.ownerType);
                const lots = o.lots ?? [];
                const activeBaux = lots.flatMap(l => l.baux ?? []);
                const loyer = activeBaux.reduce((s, b) => s + b.monthlyRent + b.charges, 0);
                return (
                  <div key={o.id} style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px 16px", display: "flex", gap: 14, alignItems: "flex-start" }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, background: "#F7F0E6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{ti.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>{o.prenom} {o.nom}</span>
                        <span style={{ background: "#f3f4f6", color: "#374151", borderRadius: 5, padding: "1px 7px", fontSize: 11 }}>{ti.label}</span>
                        {o.companyName && <span style={{ fontSize: 12, color: "#6b7280" }}>{o.companyName}</span>}
                      </div>
                      <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#6b7280", flexWrap: "wrap" }}>
                        {o.email  && <a href={`mailto:${o.email}`} style={{ color: "#2563EB", textDecoration: "none" }}>✉ {o.email}</a>}
                        {o.phone  && <span>📞 {o.phone}</span>}
                        {o.mobile && <span>📱 {o.mobile}</span>}
                        {o.address && <span>📍 {o.address}</span>}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 16, alignItems: "center", flexShrink: 0 }}>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>{o._count?.lots ?? 0}</div>
                        <div style={{ fontSize: 10, color: "#9ca3af" }}>bien(s)</div>
                      </div>
                      {loyer > 0 && (
                        <div style={{ textAlign: "center" }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#059669" }}>{loyer.toLocaleString("fr-FR")} €</div>
                          <div style={{ fontSize: 10, color: "#9ca3af" }}>loyer/mois</div>
                        </div>
                      )}
                      <button onClick={() => { setEditing(o); setShowForm(true); }} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 9px", fontSize: 12, cursor: "pointer", background: "#fff" }}>✏</button>
                      <button onClick={() => del(o.id)} style={{ border: "1px solid #fecaca", borderRadius: 6, padding: "5px 9px", fontSize: 12, cursor: "pointer", color: "#dc2626", background: "#fff" }}>✕</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <OwnerForm owner={editing} onSave={save} onClose={() => { setShowForm(false); setEditing(null); }} />
      )}
    </div>
  );
}

function OwnerForm({ owner, onSave, onClose }: { owner: Owner | null; onSave: (d: Partial<Owner>) => void; onClose: () => void }) {
  const [f, setF] = useState({
    prenom: owner?.prenom ?? "", nom: owner?.nom ?? "",
    ownerType: owner?.ownerType ?? "individual",
    email: owner?.email ?? "", phone: owner?.phone ?? "", mobile: owner?.mobile ?? "",
    companyName: owner?.companyName ?? "", siret: owner?.siret ?? "",
    address: owner?.address ?? "",
    iban: owner?.iban ?? "", bic: owner?.bic ?? "", bankName: owner?.bankName ?? "",
    notes: owner?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);

  function set(k: string, v: string) { setF(p => ({ ...p, [k]: v })); }

  async function submit() {
    if (!f.prenom.trim() || !f.nom.trim()) return;
    setSaving(true);
    await onSave({ id: owner?.id, ...f });
    setSaving(false);
  }

  const isCompany = f.ownerType !== "individual";

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 40 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 580, maxWidth: "95vw", maxHeight: "90vh", background: "#fff", zIndex: 50, display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", borderRadius: 16 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{owner ? "Modifier propriétaire" : "Nouveau propriétaire"}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer" }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <F label="Type *">
            <div style={{ display: "flex", gap: 8 }}>
              {OWNER_TYPES.map(t => (
                <button key={t.value} onClick={() => set("ownerType", t.value)} style={{ flex: 1, padding: "8px 4px", fontSize: 12, borderRadius: 8, cursor: "pointer", border: `1px solid ${f.ownerType === t.value ? GOLD : "#e5e7eb"}`, background: f.ownerType === t.value ? "#F7F0E6" : "#fff", color: f.ownerType === t.value ? GOLD : "#374151", fontWeight: f.ownerType === t.value ? 600 : 400 }}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </F>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <F label="Prénom *"><input autoFocus value={f.prenom} onChange={e => set("prenom", e.target.value)} style={inp} /></F>
            <F label="Nom *"><input value={f.nom} onChange={e => set("nom", e.target.value)} style={inp} /></F>
          </div>

          {isCompany && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <F label="Raison sociale"><input value={f.companyName} onChange={e => set("companyName", e.target.value)} style={inp} placeholder="SCI Dupont..." /></F>
              <F label="SIRET"><input value={f.siret} onChange={e => set("siret", e.target.value)} style={inp} placeholder="12345678900001" /></F>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <F label="Email"><input value={f.email} onChange={e => set("email", e.target.value)} style={inp} type="email" /></F>
            <F label="Téléphone"><input value={f.phone} onChange={e => set("phone", e.target.value)} style={inp} type="tel" /></F>
            <F label="Mobile"><input value={f.mobile} onChange={e => set("mobile", e.target.value)} style={inp} type="tel" /></F>
          </div>

          <F label="Adresse"><input value={f.address} onChange={e => set("address", e.target.value)} style={inp} placeholder="12 rue des Lilas, 31000 Toulouse" /></F>

          <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>Coordonnées bancaires</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <F label="Banque"><input value={f.bankName} onChange={e => set("bankName", e.target.value)} style={inp} placeholder="BNP Paribas" /></F>
              <F label="BIC"><input value={f.bic} onChange={e => set("bic", e.target.value)} style={inp} placeholder="BNPAFRPP" /></F>
              <F label="IBAN" ><input value={f.iban} onChange={e => set("iban", e.target.value)} style={{ ...inp, gridColumn: "span 2" }} placeholder="FR76 1234 5678 9012 3456 7890 123" /></F>
            </div>
          </div>

          <F label="Notes">
            <textarea value={f.notes} onChange={e => set("notes", e.target.value)} rows={3} style={{ ...inp, height: "auto", padding: "8px 10px", resize: "none" }} />
          </F>
        </div>

        <div style={{ padding: "14px 20px", borderTop: "1px solid #e5e7eb", display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>Annuler</button>
          <button onClick={submit} disabled={!f.prenom.trim() || !f.nom.trim() || saving} style={{ background: f.prenom.trim() && f.nom.trim() && !saving ? GOLD : "#e5e7eb", color: f.prenom.trim() && f.nom.trim() && !saving ? "#fff" : "#9ca3af", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
            {saving ? "Enregistrement…" : owner ? "Enregistrer" : "Créer"}
          </button>
        </div>
      </div>
    </>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 5 }}>{label}</div>{children}</div>;
}
const inp: React.CSSProperties = { width: "100%", height: 36, border: "1px solid #e5e7eb", borderRadius: 8, padding: "0 10px", fontSize: 13, outline: "none", background: "#f9fafb", fontFamily: "inherit", boxSizing: "border-box" };
