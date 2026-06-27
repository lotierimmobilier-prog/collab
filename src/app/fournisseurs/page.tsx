"use client";
import { useState, useEffect } from "react";
import Sidebar from "@/components/Sidebar";

const GOLD = "#B8966A";
const BORDER = "#E6E1D9";

const TYPES = [
  { value: "plomberie",    label: "Plomberie",    icon: "🔧" },
  { value: "electricite",  label: "Électricité",  icon: "⚡" },
  { value: "menuiserie",   label: "Menuiserie",   icon: "🪚" },
  { value: "maconnerie",   label: "Maçonnerie",   icon: "🏗" },
  { value: "peinture",     label: "Peinture",     icon: "🎨" },
  { value: "chauffage",    label: "Chauffage",    icon: "🔥" },
  { value: "nettoyage",    label: "Nettoyage",    icon: "🧹" },
  { value: "serrurerie",   label: "Serrurerie",   icon: "🔑" },
  { value: "jardinage",    label: "Jardinage",    icon: "🌿" },
  { value: "autre",        label: "Autre",        icon: "🔨" },
];

function typeInfo(v: string) { return TYPES.find(t => t.value === v) ?? { icon: "🔨", label: v }; }

interface Supplier {
  id: string; name: string; type: string; contact?: string;
  phone?: string; email?: string; address?: string; siret?: string;
  notes?: string; active: boolean; ordersCount?: number; metier?: string;
  insuranceType?: string; insurer?: string; insurancePolicy?: string;
  insuranceExpiry?: string | null; hasInsuranceDoc?: boolean;
  urssafExpiry?: string | null; hasUrssafDoc?: boolean;
}

// Statut de l'attestation d'assurance (décennale / RC pro).
function insuranceStatus(expiry?: string | null): { label: string; color: string } | null {
  if (!expiry) return null;
  const days = Math.floor((new Date(expiry).getTime() - Date.now()) / 86_400_000);
  if (isNaN(days)) return null;
  if (days < 0) return { label: "Assurance expirée", color: "#DC2626" };
  if (days <= 30) return { label: "Assurance expire bientôt", color: "#B45309" };
  return { label: "Assurance à jour", color: "#2F855A" };
}

// Badge générique de conformité (URSSAF…).
function confBadge(expiry: string | null | undefined, name: string): { label: string; color: string } | null {
  if (!expiry) return null;
  const days = Math.floor((new Date(expiry).getTime() - Date.now()) / 86_400_000);
  if (isNaN(days)) return null;
  if (days < 0) return { label: `${name} expirée`, color: "#DC2626" };
  if (days <= 30) return { label: `${name} expire bientôt`, color: "#B45309" };
  return { label: `${name} à jour`, color: "#2F855A" };
}

function fileToB64(file: File): Promise<{ name: string; mime: string; size: number; data: string }> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res({ name: file.name, mime: file.type || "application/octet-stream", size: file.size, data: String(r.result).split(",")[1] || "" });
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

export default function FournisseursPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState<Supplier | null>(null);
  const [filterType, setFilterType] = useState("all");
  const [search, setSearch]       = useState("");
  const [enriching, setEnriching] = useState<string | null>(null); // id en cours, ou "batch"
  const [enrichMsg, setEnrichMsg] = useState("");

  // Auguste devine le métier d'un fournisseur (recherche web + mails échangés).
  async function enrichOne(s: Supplier) {
    setEnriching(s.id); setEnrichMsg("");
    try {
      const r = await fetch(`/api/fournisseurs/${s.id}/metier`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      const d = await r.json();
      if (!r.ok) { setEnrichMsg(`${s.name} : ${d.error || "échec"}`); return; }
      const ti = typeInfo(d.type);
      setEnrichMsg(d.applied
        ? `${s.name} → ${ti.icon} ${ti.label}${d.metier ? ` (${d.metier})` : ""} — confiance ${d.confidence}%.`
        : `${s.name} : Auguste hésite (${d.metier || "?"}, confiance ${d.confidence}%) — non appliqué, à vérifier.`);
      await load();
    } catch {
      setEnrichMsg(`${s.name} : erreur réseau.`);
    } finally { setEnriching(null); }
  }

  // Complète en lot les métiers manquants (fournisseurs en catégorie « Autre »).
  async function enrichMissing() {
    setEnriching("batch"); setEnrichMsg("Auguste recherche les métiers manquants… (cela peut prendre une minute)");
    try {
      const r = await fetch("/api/fournisseurs/metier/enrich-missing", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ limit: 12 }) });
      const d = await r.json();
      setEnrichMsg(r.ok ? d.message : (d.error || "Échec de l'enrichissement."));
      await load();
    } catch {
      setEnrichMsg("Erreur réseau pendant l'enrichissement.");
    } finally { setEnriching(null); }
  }

  async function load() {
    setLoading(true);
    const r = await fetch("/api/fournisseurs");
    if (r.ok) setSuppliers(await r.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function saveSupplier(data: Record<string, unknown>) {
    const isEdit = !!data.id;
    const r = await fetch(isEdit ? `/api/fournisseurs/${data.id}` : "/api/fournisseurs", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (r.ok) { await load(); setShowForm(false); setEditing(null); }
  }

  async function deleteSupplier(id: string) {
    if (!confirm("Supprimer ce fournisseur ?")) return;
    await fetch(`/api/fournisseurs/${id}`, { method: "DELETE" });
    await load();
  }

  // Relance « justificatifs à jour » (assurance / URSSAF) par email.
  const [relancing, setRelancing] = useState<string | null>(null);
  async function relance(s: Supplier) {
    if (!s.email) { alert("Ce fournisseur n'a pas d'adresse email."); return; }
    if (!confirm(`Envoyer à ${s.name} (${s.email}) une demande de dépôt de son assurance et de son attestation URSSAF ?`)) return;
    setRelancing(s.id);
    try {
      const r = await fetch(`/api/fournisseurs/${s.id}/relance`, { method: "POST" });
      const d = await r.json();
      alert(r.ok ? `Demande envoyée à ${d.sentTo}.` : (d.error || "Envoi impossible."));
    } catch { alert("Erreur réseau."); }
    finally { setRelancing(null); }
  }
  async function copyPortal(s: Supplier) {
    const r = await fetch(`/api/fournisseurs/${s.id}/relance`);
    const d = await r.json();
    if (r.ok && d.url) { try { await navigator.clipboard.writeText(d.url); alert("Lien de l'espace fournisseur copié :\n" + d.url); } catch { prompt("Lien de l'espace fournisseur :", d.url); } }
    else alert(d.error || "Impossible de générer le lien.");
  }

  const filtered = suppliers.filter(s => {
    const matchType = filterType === "all" || s.type === filterType;
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.email?.toLowerCase().includes(search.toLowerCase()) || s.contact?.toLowerCase().includes(search.toLowerCase());
    return matchType && matchSearch;
  });

  return (
    <div style={{ display: "flex", height: "100vh", background: "#f9fafb", fontFamily: "'Inter', sans-serif" }}>
      <Sidebar active="fournisseurs" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "14px 24px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: 0 }}>🔧 Fournisseurs</h1>
            <p style={{ fontSize: 12, color: "#6b7280", margin: 0, marginTop: 2 }}>{suppliers.length} fournisseur(s) enregistré(s)</p>
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…"
            style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 12px", fontSize: 13, outline: "none", width: 200, background: "#f9fafb" }} />
          {suppliers.filter(s => s.type === "autre").length > 0 && (
            <button onClick={enrichMissing} disabled={enriching !== null} title="Auguste recherche le métier des fournisseurs sans catégorie (recherche web + mails)"
              style={{ background: "#fff", color: GOLD, border: `1px solid ${GOLD}`, borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 500, cursor: enriching ? "default" : "pointer", opacity: enriching ? 0.6 : 1 }}>
              {enriching === "batch" ? "Recherche…" : `✨ Métiers manquants (${suppliers.filter(s => s.type === "autre").length})`}
            </button>
          )}
          <button onClick={() => { setEditing(null); setShowForm(true); }} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
            + Ajouter fournisseur
          </button>
        </div>

        {enrichMsg && (
          <div style={{ background: "#F7F0E6", borderBottom: "1px solid #e5e7eb", padding: "8px 24px", fontSize: 12.5, color: "#7a5c33", display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ flex: 1 }}>{enrichMsg}</span>
            <button onClick={() => setEnrichMsg("")} style={{ background: "none", border: "none", cursor: "pointer", color: "#7a5c33", fontSize: 16 }}>×</button>
          </div>
        )}

        {/* Filtres par type */}
        <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "8px 24px", display: "flex", gap: 6, flexWrap: "wrap" }}>
          <TypePill label="Tous" value="all" active={filterType === "all"} count={suppliers.length} onClick={() => setFilterType("all")} />
          {TYPES.map(t => {
            const count = suppliers.filter(s => s.type === t.value).length;
            return count > 0 ? <TypePill key={t.value} label={`${t.icon} ${t.label}`} value={t.value} active={filterType === t.value} count={count} onClick={() => setFilterType(t.value)} /> : null;
          })}
        </div>

        {/* Liste */}
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 60, color: "#9ca3af" }}>Chargement…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, color: "#9ca3af" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔧</div>
              <div style={{ fontWeight: 600, color: "#374151", marginBottom: 6 }}>Aucun fournisseur</div>
              <div style={{ fontSize: 13 }}>Ajoutez vos prestataires et entreprises partenaires</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
              {filtered.map(s => {
                const ti = typeInfo(s.type);
                return (
                  <div key={s.id} style={{ background: "#fff", borderRadius: 12, border: "1px solid #e5e7eb", padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                      <div style={{ width: 44, height: 44, borderRadius: 10, background: "#F7F0E6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>
                        {ti.icon}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <span style={{ fontWeight: 700, fontSize: 14, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.name}</span>
                          {!s.active && <span style={{ background: "#f3f4f6", color: "#6b7280", borderRadius: 5, padding: "1px 6px", fontSize: 10 }}>Inactif</span>}
                        </div>
                        <span style={{ background: "#F7F0E6", color: GOLD, borderRadius: 5, padding: "1px 7px", fontSize: 11, fontWeight: 500 }}>{ti.icon} {ti.label}</span>
                        {s.metier && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 3 }}>{s.metier}</div>}
                        {(() => {
                          const ins = insuranceStatus(s.insuranceExpiry);
                          const urs = confBadge(s.urssafExpiry, "URSSAF");
                          return (ins || urs) ? (
                            <div style={{ marginTop: 4, display: "flex", gap: 5, flexWrap: "wrap" }}>
                              {ins && <span style={{ background: ins.color + "20", color: ins.color, borderRadius: 5, padding: "1px 7px", fontSize: 10.5, fontWeight: 600 }}>🛡 {ins.label}</span>}
                              {urs && <span style={{ background: urs.color + "20", color: urs.color, borderRadius: 5, padding: "1px 7px", fontSize: 10.5, fontWeight: 600 }}>📄 {urs.label}</span>}
                            </div>
                          ) : null;
                        })()}
                      </div>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={() => enrichOne(s)} disabled={enriching !== null}
                          title="Deviner le métier avec Auguste (recherche web + mails)"
                          style={{ border: `1px solid ${GOLD}`, borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: enriching ? "default" : "pointer", color: GOLD, background: "#fff", opacity: enriching && enriching !== s.id ? 0.5 : 1 }}>
                          {enriching === s.id ? "…" : "🔎"}
                        </button>
                        <button onClick={() => { setEditing(s); setShowForm(true); }} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer", background: "#fff" }}>✏</button>
                        <button onClick={() => deleteSupplier(s.id)} style={{ border: "1px solid #fecaca", borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer", color: "#dc2626", background: "#fff" }}>✕</button>
                      </div>
                    </div>

                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {s.contact && <InfoLine icon="👤" text={s.contact} />}
                      {s.phone   && <InfoLine icon="📞" text={s.phone} href={`tel:${s.phone}`} />}
                      {s.email   && <InfoLine icon="✉️"  text={s.email} href={`mailto:${s.email}`} />}
                      {s.address && <InfoLine icon="📍" text={s.address} />}
                      {s.siret   && <InfoLine icon="🏢" text={`SIRET : ${s.siret}`} />}
                    </div>

                    {s.notes && (
                      <div style={{ background: "#f9fafb", borderRadius: 8, padding: "8px 10px", fontSize: 12, color: "#6b7280", lineHeight: 1.4 }}>{s.notes}</div>
                    )}

                    {(s.ordersCount ?? 0) > 0 && (
                      <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 8, fontSize: 11, color: "#9ca3af" }}>
                        📋 {s.ordersCount} ordre(s) de service
                      </div>
                    )}

                    <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button onClick={() => relance(s)} disabled={relancing === s.id || !s.email}
                        title={s.email ? "Demander assurance + URSSAF par email" : "Pas d'email"}
                        style={{ border: `1px solid ${BORDER}`, borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: s.email ? "pointer" : "default", background: "#fff", color: s.email ? GOLD : "#9ca3af" }}>
                        {relancing === s.id ? "Envoi…" : "📧 Demander justificatifs"}
                      </button>
                      <button onClick={() => copyPortal(s)} style={{ border: `1px solid ${BORDER}`, borderRadius: 6, padding: "4px 8px", fontSize: 11, cursor: "pointer", background: "#fff", color: "#6b7280" }}>
                        🔗 Lien dépôt
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <SupplierForm
          supplier={editing}
          onSave={saveSupplier}
          onClose={() => { setShowForm(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

function TypePill({ label, value, active, count, onClick }: { label: string; value: string; active: boolean; count: number; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ background: active ? GOLD : "#f3f4f6", color: active ? "#fff" : "#374151", border: "none", borderRadius: 20, padding: "4px 12px", fontSize: 12, cursor: "pointer", fontWeight: active ? 600 : 400 }}>
      {label} <span style={{ opacity: 0.7 }}>({count})</span>
    </button>
  );
}

function InfoLine({ icon, text, href }: { icon: string; text: string; href?: string }) {
  const style: React.CSSProperties = { fontSize: 12, color: "#6b7280", display: "flex", gap: 5, alignItems: "flex-start" };
  const content = <><span>{icon}</span><span style={{ flex: 1 }}>{text}</span></>;
  if (href) return <a href={href} style={{ ...style, textDecoration: "none", color: "#2563EB" }}>{content}</a>;
  return <div style={style}>{content}</div>;
}

function SupplierForm({ supplier, onSave, onClose }: { supplier: Supplier | null; onSave: (d: Record<string, unknown>) => void; onClose: () => void }) {
  const [f, setF] = useState({
    name:    supplier?.name    ?? "",
    type:    supplier?.type    ?? "autre",
    contact: supplier?.contact ?? "",
    phone:   supplier?.phone   ?? "",
    email:   supplier?.email   ?? "",
    address: supplier?.address ?? "",
    siret:   supplier?.siret   ?? "",
    notes:   supplier?.notes   ?? "",
    active:  supplier?.active  ?? true,
    insuranceType:   supplier?.insuranceType   ?? "",
    insurer:         supplier?.insurer         ?? "",
    insurancePolicy: supplier?.insurancePolicy ?? "",
    insuranceExpiry: supplier?.insuranceExpiry ? supplier.insuranceExpiry.slice(0, 10) : "",
    urssafExpiry:    supplier?.urssafExpiry    ? supplier.urssafExpiry.slice(0, 10) : "",
  });
  const [insFile, setInsFile] = useState<{ name: string; mime: string; size: number; data: string } | null>(null);
  const [ursFile, setUrsFile] = useState<{ name: string; mime: string; size: number; data: string } | null>(null);
  const [saving, setSaving] = useState(false);

  function set(k: string, v: string | boolean) { setF(p => ({ ...p, [k]: v })); }

  async function submit() {
    if (!f.name.trim()) return;
    setSaving(true);
    await onSave({ id: supplier?.id, ...f, ...(insFile ? { insuranceDoc: insFile } : {}), ...(ursFile ? { urssafDoc: ursFile } : {}) });
    setSaving(false);
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 40 }} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 520, background: "#fff", zIndex: 50, display: "flex", flexDirection: "column", boxShadow: "-4px 0 24px rgba(0,0,0,0.1)" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{supplier ? "Modifier fournisseur" : "Nouveau fournisseur"}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer" }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <F label="Nom *"><input autoFocus value={f.name} onChange={e => set("name", e.target.value)} style={inp} placeholder="Plomberie Durand SARL" /></F>

          <F label="Type d'activité">
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {TYPES.map(t => (
                <button key={t.value} onClick={() => set("type", t.value)} style={{ padding: "4px 10px", fontSize: 11, borderRadius: 20, cursor: "pointer", border: `1px solid ${f.type === t.value ? GOLD : "#e5e7eb"}`, background: f.type === t.value ? "#F7F0E6" : "#fff", color: f.type === t.value ? GOLD : "#374151", fontWeight: f.type === t.value ? 600 : 400 }}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </F>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <F label="Contact"><input value={f.contact} onChange={e => set("contact", e.target.value)} style={inp} placeholder="Jean Durand" /></F>
            <F label="Téléphone"><input value={f.phone} onChange={e => set("phone", e.target.value)} style={inp} placeholder="06 00 00 00 00" type="tel" /></F>
            <F label="Email"><input value={f.email} onChange={e => set("email", e.target.value)} style={inp} placeholder="contact@plomberie.fr" type="email" /></F>
            <F label="SIRET"><input value={f.siret} onChange={e => set("siret", e.target.value)} style={inp} placeholder="12345678900001" /></F>
          </div>

          <F label="Adresse"><input value={f.address} onChange={e => set("address", e.target.value)} style={inp} placeholder="12 rue des Artisans, 31000 Toulouse" /></F>

          {/* Conformité assurance (décennale / RC pro) */}
          <div style={{ borderTop: `1px solid ${"#E6E1D9"}`, paddingTop: 14, marginTop: 2 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 10 }}>🛡 ASSURANCE (DÉCENNALE / RC PRO)</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <F label="Type de garantie">
                <select value={f.insuranceType} onChange={e => set("insuranceType", e.target.value)} style={inp}>
                  <option value="">—</option>
                  <option value="decennale">Décennale</option>
                  <option value="rcpro">RC professionnelle</option>
                  <option value="both">Décennale + RC pro</option>
                  <option value="autre">Autre</option>
                </select>
              </F>
              <F label="Date de validité"><input type="date" value={f.insuranceExpiry} onChange={e => set("insuranceExpiry", e.target.value)} style={inp} /></F>
              <F label="Assureur"><input value={f.insurer} onChange={e => set("insurer", e.target.value)} style={inp} placeholder="ex. AXA" /></F>
              <F label="N° de police"><input value={f.insurancePolicy} onChange={e => set("insurancePolicy", e.target.value)} style={inp} /></F>
            </div>
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 5 }}>Attestation d'assurance (PDF / photo)</div>
              <input type="file" accept="image/*,.pdf" onChange={async e => { const fl = e.target.files?.[0]; if (fl) { if (fl.size > 20 * 1024 * 1024) { alert("Fichier trop volumineux (max 20 Mo)."); return; } setInsFile(await fileToB64(fl)); } }} style={{ fontSize: 13 }} />
              {insFile && <span style={{ fontSize: 12, color: "#2F855A", marginLeft: 8 }}>✓ {insFile.name}</span>}
              {!insFile && supplier?.hasInsuranceDoc && <a href={`/api/fournisseurs/${supplier.id}/insurance`} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: GOLD, marginLeft: 8 }}>📎 Voir l'attestation actuelle</a>}
            </div>

            <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px dashed ${BORDER}` }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 10 }}>📄 ATTESTATION DE VIGILANCE URSSAF</div>
              <F label="Date de validité"><input type="date" value={f.urssafExpiry} onChange={e => set("urssafExpiry", e.target.value)} style={inp} /></F>
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 5 }}>Attestation URSSAF (PDF / photo)</div>
                <input type="file" accept="image/*,.pdf" onChange={async e => { const fl = e.target.files?.[0]; if (fl) { if (fl.size > 20 * 1024 * 1024) { alert("Fichier trop volumineux (max 20 Mo)."); return; } setUrsFile(await fileToB64(fl)); } }} style={{ fontSize: 13 }} />
                {ursFile && <span style={{ fontSize: 12, color: "#2F855A", marginLeft: 8 }}>✓ {ursFile.name}</span>}
                {!ursFile && supplier?.hasUrssafDoc && <a href={`/api/fournisseurs/${supplier.id}/urssaf`} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: GOLD, marginLeft: 8 }}>📎 Voir l'attestation actuelle</a>}
              </div>
            </div>
          </div>

          <F label="Notes">
            <textarea value={f.notes} onChange={e => set("notes", e.target.value)} rows={3} style={{ ...inp, height: "auto", padding: "8px 10px", resize: "none" }} placeholder="Spécialités, tarifs horaires, conditions…" />
          </F>

          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", fontSize: 13 }}>
            <input type="checkbox" checked={f.active} onChange={e => set("active", e.target.checked)} style={{ width: 14, height: 14 }} />
            Fournisseur actif
          </label>
        </div>

        <div style={{ padding: "14px 20px", borderTop: "1px solid #e5e7eb", display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>Annuler</button>
          <button onClick={submit} disabled={!f.name.trim() || saving} style={{ background: !f.name.trim() ? "#e5e7eb" : GOLD, color: !f.name.trim() ? "#9ca3af" : "#fff", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
            {saving ? "Enregistrement…" : supplier ? "Enregistrer" : "Créer"}
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
