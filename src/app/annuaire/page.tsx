"use client";
import Link from "next/link";
import { useState, useEffect, useCallback } from "react";

const GOLD = "#B8966A";
const DARK = "#1C1A17";
const BORDER = "#E6E1D9";

interface Contact {
  id: string; type: string;
  prenom?: string | null; nom?: string | null; raisonSociale?: string | null;
  email?: string | null; phone?: string | null; note?: string | null;
}

const TYPES: { id: string; label: string; color: string }[] = [
  { id: "fournisseur",  label: "Fournisseurs",  color: "#0EA5E9" },
  { id: "proprietaire", label: "Propriétaires", color: "#8B5CF6" },
  { id: "locataire",    label: "Locataires",    color: "#10B981" },
  { id: "direction",    label: "Direction",     color: "#B8966A" },
  { id: "commercial",   label: "Agents comm.",  color: "#F59E0B" },
  { id: "tutelle",      label: "Tutelles",      color: "#EF4444" },
  { id: "autre",        label: "Autres",        color: "#6B7280" },
];
const typeMeta = (t: string) => TYPES.find(x => x.id === t) ?? TYPES[TYPES.length - 1];
const contactName = (c: Contact) => c.raisonSociale || [c.prenom, c.nom].filter(Boolean).join(" ") || c.email || "—";

export default function AnnuairePage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filter, setFilter] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter) params.set("type", filter);
      if (q.trim()) params.set("q", q.trim());
      const r = await fetch(`/api/contacts?${params}`);
      const d = await r.json();
      setContacts(d.contacts ?? []);
    } catch { /* silencieux */ }
    finally { setLoading(false); }
  }, [filter, q]);

  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);

  const counts = TYPES.map(t => ({ ...t, n: contacts.filter(c => c.type === t.id).length }));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#F3F1EC", overflow: "hidden" }}>
      {/* Barre haut */}
      <div style={{ height: 44, flexShrink: 0, background: "#fff", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "center", padding: "0 16px", gap: 12 }}>
        <Link href="/" style={{ textDecoration: "none", display: "flex", alignItems: "center", gap: 7, background: "#F7F0E6", border: `1px solid ${GOLD}44`, borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 600, color: GOLD }}>← Retour Collab</Link>
        <span style={{ fontSize: 13, fontWeight: 600, color: DARK }}>Annuaire</span>
        <Link href="/messagerie" style={{ marginLeft: "auto", textDecoration: "none", fontSize: 12, fontWeight: 600, color: "#1C1A17", background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "5px 11px" }}>✉ Messagerie</Link>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "20px 24px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          {/* Recherche + ajout */}
          <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher un contact (nom, email, téléphone)…"
              style={{ flex: 1, height: 38, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "0 12px", fontSize: 13, outline: "none", background: "#fff" }} />
            <button onClick={() => setShowAdd(true)} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>+ Ajouter</button>
          </div>

          {/* Filtres par type */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 18 }}>
            <Chip active={filter === ""} color={DARK} onClick={() => setFilter("")}>Tous</Chip>
            {counts.map(t => (
              <Chip key={t.id} active={filter === t.id} color={t.color} onClick={() => setFilter(filter === t.id ? "" : t.id)}>
                {t.label}{t.n > 0 ? ` (${t.n})` : ""}
              </Chip>
            ))}
          </div>

          {/* Liste */}
          {loading ? (
            <div style={{ color: "#9ca3af", fontSize: 13, textAlign: "center", padding: 40 }}>Chargement…</div>
          ) : contacts.length === 0 ? (
            <div style={{ color: "#9ca3af", fontSize: 13, textAlign: "center", padding: 40 }}>Aucun contact. Les expéditeurs de mails inconnus peuvent être ajoutés depuis la messagerie.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {contacts.map(c => {
                const m = typeMeta(c.type);
                return (
                  <div key={c.id} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 38, height: 38, borderRadius: "50%", background: m.color + "1A", color: m.color, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                      {contactName(c).slice(0, 1).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: DARK }}>{contactName(c)}</div>
                      <div style={{ fontSize: 12, color: "#6b7280", display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {c.email && <span>{c.email}</span>}
                        {c.phone && <span>{c.phone}</span>}
                      </div>
                    </div>
                    <span style={{ background: m.color + "18", color: m.color, borderRadius: 6, padding: "3px 9px", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{m.label.replace(/s$|x$/, "")}</span>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      {c.email && <a href={`mailto:${c.email}`} title="Envoyer un mail" style={iconBtn}>✉</a>}
                      {c.phone && <a href={`tel:${c.phone}`} title="Appeler" style={iconBtn}>📞</a>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showAdd && <AddContactModal onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
    </div>
  );
}

function AddContactModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ type: "fournisseur", prenom: "", nom: "", raisonSociale: "", email: "", phone: "", note: "" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  async function save() {
    setSaving(true); setErr("");
    try {
      const r = await fetch("/api/contacts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const d = await r.json();
      if (d.error) { setErr(d.error); return; }
      onSaved();
    } catch { setErr("Erreur réseau"); }
    finally { setSaving(false); }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: 460, maxWidth: "92vw", maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ background: DARK, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>Nouveau contact</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#9ca3af", fontSize: 20, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
          <L label="Type">
            <select value={form.type} onChange={e => set("type", e.target.value)} style={inp}>
              {TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
          </L>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <L label="Prénom"><input value={form.prenom} onChange={e => set("prenom", e.target.value)} style={inp} /></L>
            <L label="Nom"><input value={form.nom} onChange={e => set("nom", e.target.value)} style={inp} /></L>
          </div>
          <L label="Raison sociale (sociétés)"><input value={form.raisonSociale} onChange={e => set("raisonSociale", e.target.value)} style={inp} /></L>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <L label="Email"><input value={form.email} onChange={e => set("email", e.target.value)} style={inp} /></L>
            <L label="Téléphone"><input value={form.phone} onChange={e => set("phone", e.target.value)} style={inp} /></L>
          </div>
          <L label="Note"><input value={form.note} onChange={e => set("note", e.target.value)} style={inp} /></L>
          {err && <span style={{ color: "#dc2626", fontSize: 12 }}>{err}</span>}
          <button onClick={save} disabled={saving} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "10px 0", fontSize: 14, fontWeight: 600, cursor: "pointer", marginTop: 4 }}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Chip({ active, color, onClick, children }: { active: boolean; color: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{ border: `1px solid ${active ? color : BORDER}`, background: active ? color + "18" : "#fff", color: active ? color : "#6b7280", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
      {children}
    </button>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      {children}
    </div>
  );
}

const inp: React.CSSProperties = { width: "100%", height: 36, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "0 10px", fontSize: 13, outline: "none", background: "#f9fafb", fontFamily: "inherit", boxSizing: "border-box" };
const iconBtn: React.CSSProperties = { width: 32, height: 32, borderRadius: 8, border: `1px solid ${BORDER}`, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", textDecoration: "none", fontSize: 14, color: "#374151" };
