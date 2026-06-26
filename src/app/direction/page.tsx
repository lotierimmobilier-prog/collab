"use client";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import MeetingsSection from "@/components/direction/MeetingsSection";

const GOLD = "#B8966A"; const DARK = "#1C1A17"; const BORDER = "#E6E1D9";
const MEETINGS_TAB = "comptes-rendus";

type FieldType = "text" | "date" | "number" | "select" | "textarea";
interface Field { key: string; label: string; type: FieldType; options?: { value: string; label: string }[]; full?: boolean }
interface Section {
  id: string; resource: string; title: string;
  fields: Field[];
  required: string;
  primary: string;            // champ titre de la ligne
  expiry?: { key: string; label: string }[];  // champs date à surveiller (échéance)
  detailBase?: string;        // base de lien vers une fiche détaillée (ex. véhicules)
}

const SECTIONS: Section[] = [
  {
    id: "flotte", resource: "vehicles", title: "Flotte automobile", required: "label", primary: "label", detailBase: "/direction/vehicule",
    expiry: [{ key: "controleTechnique", label: "Contrôle technique" }, { key: "endDate", label: "Fin de contrat" }],
    fields: [
      { key: "label", label: "Véhicule (marque + modèle)", type: "text", full: true },
      { key: "immatriculation", label: "Immatriculation", type: "text" },
      { key: "holdType", label: "Détention", type: "select", options: [
        { value: "propriete", label: "Propriété" }, { value: "leasing", label: "Leasing / LOA" }, { value: "location", label: "Location" } ] },
      { key: "assignedName", label: "Attribué à", type: "text" },
      { key: "insurer", label: "Assureur", type: "text" },
      { key: "monthlyCost", label: "Coût mensuel (€)", type: "number" },
      { key: "startDate", label: "Début", type: "date" },
      { key: "endDate", label: "Fin de contrat", type: "date" },
      { key: "controleTechnique", label: "Contrôle technique", type: "date" },
      { key: "note", label: "Note", type: "textarea", full: true },
    ],
  },
  {
    id: "locaux", resource: "premises", title: "Locaux de l'entreprise", required: "label", primary: "label", detailBase: "/direction/local",
    expiry: [{ key: "endDate", label: "Fin de bail" }],
    fields: [
      { key: "label", label: "Désignation du local", type: "text", full: true },
      { key: "address", label: "Adresse", type: "text", full: true },
      { key: "bailleur", label: "Bailleur", type: "text" },
      { key: "insurer", label: "Assureur", type: "text" },
      { key: "rentMonthly", label: "Loyer (€/mois)", type: "number" },
      { key: "charges", label: "Charges (€/mois)", type: "number" },
      { key: "startDate", label: "Début du bail", type: "date" },
      { key: "endDate", label: "Fin du bail", type: "date" },
      { key: "note", label: "Note", type: "textarea", full: true },
    ],
  },
  {
    id: "cartes", resource: "procards", title: "Cartes professionnelles", required: "holderName", primary: "holderName",
    expiry: [{ key: "expiryDate", label: "Validité" }],
    fields: [
      { key: "holderName", label: "Titulaire", type: "text", full: true },
      { key: "cardNumber", label: "Numéro de carte", type: "text" },
      { key: "cardType", label: "Mention(s)", type: "select", options: [
        { value: "transaction", label: "Transaction (T)" },
        { value: "gestion",     label: "Gestion immobilière (G)" },
        { value: "syndic",      label: "Syndic de copropriété (S)" },
        { value: "tg",          label: "Transaction + Gestion (T + G)" },
        { value: "tgs",         label: "T + G + S" } ] },
      { key: "issuedBy", label: "Délivrée par (CCI)", type: "text" },
      { key: "startDate", label: "Délivrance", type: "date" },
      { key: "expiryDate", label: "Date de validité", type: "date" },
      { key: "note", label: "Note", type: "textarea", full: true },
    ],
  },
  {
    id: "assurances", resource: "insurance", title: "Assurances", required: "type", primary: "type",
    expiry: [{ key: "endDate", label: "Échéance" }],
    fields: [
      { key: "type", label: "Type d'assurance", type: "select", options: [
        { value: "rc", label: "Responsabilité civile" }, { value: "rcpro", label: "Responsabilité civile professionnelle" },
        { value: "bureaux", label: "Assurance des bureaux" }, { value: "autre", label: "Autre" } ] },
      { key: "insurer", label: "Assureur", type: "text" },
      { key: "policyNumber", label: "N° de police", type: "text" },
      { key: "premiumAmount", label: "Prime annuelle (€)", type: "number" },
      { key: "startDate", label: "Début", type: "date" },
      { key: "endDate", label: "Échéance", type: "date" },
      { key: "note", label: "Note", type: "textarea", full: true },
    ],
  },
];

const SELECT_LABEL: Record<string, string> = {
  propriete: "Propriété", leasing: "Leasing / LOA", location: "Location",
  transaction: "Transaction (T)", gestion: "Gestion (G)", syndic: "Syndic (S)", both: "Transaction + Gestion", tg: "T + G", tgs: "T + G + S",
  rc: "Responsabilité civile", rcpro: "RC professionnelle", bureaux: "Assurance bureaux", autre: "Autre",
};

type Row = Record<string, unknown> & { id: string };

function fmtDate(v: unknown) { return v ? new Date(String(v)).toLocaleDateString("fr-FR") : "—"; }
function daysUntil(v: unknown): number | null { if (!v) return null; return Math.ceil((new Date(String(v)).getTime() - Date.now()) / 86400_000); }
function expiryStyle(days: number | null) {
  if (days === null) return null;
  if (days < 0)  return { bg: "#F5E9E6", color: "#9B2C2C", label: `expiré (${Math.abs(days)} j)` };
  if (days <= 30) return { bg: "#F7F0E6", color: "#8A6D44", label: `dans ${days} j` };
  return { bg: "#F2F1EC", color: "#6b7280", label: `dans ${days} j` };
}

export default function DirectionPage() {
  const { data: session } = useSession();
  const role = session?.user?.roleId;
  const allowed = role === "admin" || role === "direction" || role === "dirigeant";
  const [tab, setTab] = useState(SECTIONS[0].id);
  const section = SECTIONS.find(s => s.id === tab);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F3F1EC" }}>
      <Sidebar active="direction" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100vh", overflow: "hidden" }}>
        <Topbar title="Direction — Gestion d'entreprise" />
        {!allowed ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", fontSize: 14 }}>
            Réservé aux utilisateurs de la direction.
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
            <div style={{ maxWidth: 1000, margin: "0 auto" }}>
              {/* Onglets */}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
                {SECTIONS.map(s => (
                  <button key={s.id} onClick={() => setTab(s.id)}
                    style={{ display: "flex", alignItems: "center", gap: 6, border: `1px solid ${tab === s.id ? GOLD : BORDER}`, background: tab === s.id ? "#F7F0E6" : "#fff", color: tab === s.id ? GOLD : "#6b7280", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                    {s.title}
                  </button>
                ))}
                <button onClick={() => setTab(MEETINGS_TAB)}
                  style={{ display: "flex", alignItems: "center", gap: 6, border: `1px solid ${tab === MEETINGS_TAB ? GOLD : BORDER}`, background: tab === MEETINGS_TAB ? "#F7F0E6" : "#fff", color: tab === MEETINGS_TAB ? GOLD : "#6b7280", borderRadius: 10, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                  Comptes rendus de réunion
                </button>
              </div>
              {tab === MEETINGS_TAB
                ? <MeetingsSection />
                : section && <DirectionSection key={section.id} section={section} />}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DirectionSection({ section }: { section: Section }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Row | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/direction/${section.resource}`);
      const d = await r.json();
      setRows(d.items ?? []);
    } catch { setRows([]); } finally { setLoading(false); }
  }, [section.resource]);
  useEffect(() => { load(); }, [load]);

  async function remove(id: string) {
    if (!confirm("Supprimer cet élément ?")) return;
    await fetch(`/api/direction/${section.resource}?id=${id}`, { method: "DELETE" });
    setRows(p => p.filter(r => r.id !== id));
  }

  function displayPrimary(r: Row) {
    const v = r[section.primary];
    return SELECT_LABEL[String(v)] ?? (v ? String(v) : "—");
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: DARK }}>{section.title} <span style={{ color: "#9ca3af", fontWeight: 400 }}>({rows.length})</span></span>
        <button onClick={() => { setEditing(null); setShowForm(true); }} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Ajouter</button>
      </div>

      {loading ? (
        <div style={{ color: "#9ca3af", fontSize: 13, textAlign: "center", padding: 40 }}>Chargement…</div>
      ) : rows.length === 0 ? (
        <div style={{ color: "#9ca3af", fontSize: 13, textAlign: "center", padding: 40, background: "#fff", borderRadius: 10, border: `1px solid ${BORDER}` }}>Aucun élément. Cliquez sur « + Ajouter ».</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {rows.map(r => (
            <div key={r.id} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: DARK }}>{displayPrimary(r)}</div>
                  <div style={{ fontSize: 12, color: "#6b7280", display: "flex", gap: 12, flexWrap: "wrap", marginTop: 3 }}>
                    {section.fields.filter(f => f.key !== section.primary && f.type !== "textarea" && r[f.key]).slice(0, 5).map(f => (
                      <span key={f.key}>{f.label} : <strong style={{ color: "#374151" }}>{f.type === "date" ? fmtDate(r[f.key]) : f.type === "select" ? (SELECT_LABEL[String(r[f.key])] ?? String(r[f.key])) : String(r[f.key])}</strong></span>
                    ))}
                  </div>
                  {/* Échéances */}
                  {section.expiry && (
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                      {section.expiry.filter(e => r[e.key]).map(e => {
                        const st = expiryStyle(daysUntil(r[e.key]));
                        if (!st) return null;
                        return <span key={e.key} style={{ background: st.bg, color: st.color, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>{e.label} : {fmtDate(r[e.key])} · {st.label}</span>;
                      })}
                    </div>
                  )}
                  {!!r.note && <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 6 }}>{String(r.note)}</div>}
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                  {section.detailBase && <Link href={`${section.detailBase}/${r.id}`} style={txtBtn}>Ouvrir</Link>}
                  <button onClick={() => { setEditing(r); setShowForm(true); }} style={txtBtn}>Modifier</button>
                  <button onClick={() => remove(r.id)} style={{ ...txtBtn, color: "#9B2C2C" }}>Supprimer</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && <RecordForm section={section} record={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load(); }} />}
    </div>
  );
}

function RecordForm({ section, record, onClose, onSaved }: { section: Section; record: Row | null; onClose: () => void; onSaved: () => void }) {
  const init: Record<string, string> = {};
  for (const f of section.fields) {
    const v = record?.[f.key];
    init[f.key] = f.type === "date" && v ? new Date(String(v)).toISOString().slice(0, 10) : (v != null ? String(v) : "");
  }
  if (!record) { const sel = section.fields.find(f => f.type === "select"); if (sel?.options?.[0]) init[sel.key] = init[sel.key] || sel.options[0].value; }
  const [form, setForm] = useState(init);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function save() {
    if (!form[section.required]?.trim()) { setErr("Champ obligatoire manquant."); return; }
    setSaving(true); setErr("");
    try {
      const r = await fetch(`/api/direction/${section.resource}`, {
        method: record ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(record ? { ...form, id: record.id } : form),
      });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Erreur"); return; }
      onSaved();
    } catch { setErr("Erreur réseau"); } finally { setSaving(false); }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: 560, maxWidth: "94vw", maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
        <div style={{ background: DARK, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>{record ? "Modifier" : "Ajouter"} — {section.title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#9ca3af", fontSize: 20, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ padding: 18, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {section.fields.map(f => (
            <div key={f.key} style={{ gridColumn: f.full || f.type === "textarea" ? "1 / -1" : "auto" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" }}>{f.label}</div>
              {f.type === "select" ? (
                <select value={form[f.key] ?? ""} onChange={e => set(f.key, e.target.value)} style={inp}>
                  {f.options!.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              ) : f.type === "textarea" ? (
                <textarea value={form[f.key] ?? ""} onChange={e => set(f.key, e.target.value)} rows={2} style={{ ...inp, height: "auto", padding: "8px 10px", resize: "vertical" }} />
              ) : (
                <input type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"} value={form[f.key] ?? ""} onChange={e => set(f.key, e.target.value)} style={inp} />
              )}
            </div>
          ))}
          {err && <div style={{ gridColumn: "1 / -1", color: "#dc2626", fontSize: 12 }}>{err}</div>}
          <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button onClick={onClose} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "9px 16px", fontSize: 13, cursor: "pointer" }}>Annuler</button>
            <button onClick={save} disabled={saving} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{saving ? "Enregistrement…" : "Enregistrer"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const inp: React.CSSProperties = { width: "100%", height: 38, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "0 10px", fontSize: 13, outline: "none", background: "#f9fafb", fontFamily: "inherit", boxSizing: "border-box" };
const txtBtn: React.CSSProperties = { background: "none", border: "none", color: GOLD, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "2px 4px", textDecoration: "none" };
