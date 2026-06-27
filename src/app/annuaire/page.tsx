"use client";
import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import { DEFAULT_CONTACT_CATEGORIES, ContactCategory } from "@/lib/contactCategories";

const GOLD = "#B8966A";
const DARK = "#1C1A17";
const BORDER = "#E6E1D9";

interface Contact {
  id: string; type: string;
  prenom?: string | null; nom?: string | null; raisonSociale?: string | null;
  email?: string | null; phone?: string | null; note?: string | null;
  icsType?: string | null; icsRef?: string | null;
}

const typeMeta = (cats: ContactCategory[], t: string) =>
  cats.find(x => x.id === t) ?? cats[cats.length - 1] ?? { id: t, label: t, color: "#6B7280" };
const contactName = (c: Contact) => c.raisonSociale || [c.prenom, c.nom].filter(Boolean).join(" ") || c.email || "—";

export default function AnnuairePage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.roleId === "admin";

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [categories, setCategories] = useState<ContactCategory[]>(DEFAULT_CONTACT_CATEGORIES);
  const [filter, setFilter] = useState("");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showCats, setShowCats] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [taskFor, setTaskFor] = useState<Contact | null>(null);
  const [rdvFor, setRdvFor]   = useState<Contact | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [exportSel, setExportSel]   = useState<string[]>([]);

  // Par défaut, l'export sélectionne toutes les catégories disponibles.
  useEffect(() => { setExportSel(categories.map(c => c.id)); }, [categories]);

  const loadCategories = useCallback(async () => {
    try {
      const r = await fetch("/api/contacts/categories");
      const d = await r.json();
      if (Array.isArray(d.categories) && d.categories.length) setCategories(d.categories);
    } catch { /* garde les défauts */ }
  }, []);
  useEffect(() => { loadCategories(); }, [loadCategories]);

  async function importExisting() {
    setImporting(true); setImportMsg("");
    try {
      const r = await fetch("/api/contacts/sync", { method: "POST" });
      const d = await r.json();
      if (d.error) { setImportMsg(d.error); return; }
      setImportMsg(d.imported > 0 ? `✓ ${d.imported} contact(s) importé(s)` : "Annuaire déjà à jour");
      load();
    } catch { setImportMsg("Erreur réseau"); }
    finally { setImporting(false); setTimeout(() => setImportMsg(""), 5000); }
  }

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

  const counts = categories.map(t => ({ ...t, n: contacts.filter(c => c.type === t.id).length }));

  async function runExport(catIds: string[]) {
    if (catIds.length === 0) return;
    // Récupère tous les contacts accessibles (au-delà du filtre/recherche en cours).
    let all: Contact[] = contacts;
    try {
      const r = await fetch("/api/contacts");
      const d = await r.json();
      if (Array.isArray(d.contacts)) all = d.contacts;
    } catch { /* repli sur la liste affichée */ }

    const sel = new Set(catIds);
    const head = ["Type", "Prénom", "Nom", "Raison sociale", "Email", "Téléphone", "Note"];
    const esc = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = all.filter(c => sel.has(c.type)).map(c => [
      typeMeta(categories, c.type).label, c.prenom ?? "", c.nom ?? "", c.raisonSociale ?? "",
      c.email ?? "", c.phone ?? "", c.note ?? "",
    ].map(esc).join(";"));
    const csv = "﻿" + [head.map(esc).join(";"), ...rows].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    const tag = catIds.length === categories.length ? "annuaire" : `annuaire-${catIds.join("-")}`;
    a.href = url; a.download = `${tag}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
    setShowExport(false);
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F3F1EC" }}>
      <Sidebar active="annuaire" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100vh", overflow: "hidden" }}>
        <Topbar title="Annuaire" />

        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "20px 24px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          {/* Recherche + ajout */}
          <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center", flexWrap: "wrap" }}>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher un contact (nom, email, téléphone)…"
              style={{ flex: 1, minWidth: 220, height: 38, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "0 12px", fontSize: 13, outline: "none", background: "#fff" }} />
            <button onClick={importExisting} disabled={importing} title="Rapprocher propriétaires, locataires, fournisseurs et agents déjà en base"
              style={{ background: "#fff", color: "#374151", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
              {importing ? "Import…" : "⤓ Importer l'existant"}
            </button>
            <div style={{ position: "relative" }}>
              <button onClick={() => setShowExport(s => !s)} title="Exporter l'annuaire au format CSV (Excel)"
                style={{ background: "#fff", color: "#374151", border: `1px solid ${showExport ? GOLD : BORDER}`, borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                ⤒ Exporter (CSV)
              </button>
              {showExport && (
                <>
                  <div onClick={() => setShowExport(false)} style={{ position: "fixed", inset: 0, zIndex: 30 }} />
                  <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 31, width: 250, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.14)", padding: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>Catégories à exporter</div>
                    <label style={exportRow}>
                      <input type="checkbox"
                        checked={exportSel.length === categories.length}
                        ref={el => { if (el) el.indeterminate = exportSel.length > 0 && exportSel.length < categories.length; }}
                        onChange={e => setExportSel(e.target.checked ? categories.map(c => c.id) : [])} />
                      <span style={{ fontWeight: 600 }}>Toutes</span>
                    </label>
                    <div style={{ borderTop: `1px solid #f3f4f6`, margin: "4px 0", maxHeight: 220, overflowY: "auto" }}>
                      {categories.map(c => (
                        <label key={c.id} style={exportRow}>
                          <input type="checkbox" checked={exportSel.includes(c.id)}
                            onChange={e => setExportSel(s => e.target.checked ? [...s, c.id] : s.filter(x => x !== c.id))} />
                          <span style={{ width: 9, height: 9, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.label}</span>
                        </label>
                      ))}
                    </div>
                    <button onClick={() => runExport(exportSel)} disabled={exportSel.length === 0}
                      style={{ width: "100%", marginTop: 8, background: exportSel.length ? GOLD : "#e5e7eb", color: "#fff", border: "none", borderRadius: 8, padding: "9px 0", fontSize: 13, fontWeight: 600, cursor: exportSel.length ? "pointer" : "default" }}>
                      Exporter la sélection
                    </button>
                  </div>
                </>
              )}
            </div>
            {isAdmin && (
              <button onClick={() => setShowCats(true)} title="Gérer les catégories de contacts"
                style={{ background: "#fff", color: "#374151", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "9px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                🏷 Catégories
              </button>
            )}
            <button onClick={() => setShowAdd(true)} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>+ Ajouter</button>
          </div>
          {!isAdmin && session?.user && (
            <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: -8, marginBottom: 12 }}>Vous voyez vos propres contacts. La direction dispose d&apos;une vue globale de l&apos;annuaire.</div>
          )}
          {importMsg && <div style={{ fontSize: 12, color: "#059669", marginTop: -8, marginBottom: 12 }}>{importMsg}</div>}

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
                const m = typeMeta(categories, c.type);
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
                    {c.icsRef && (
                      <span title={`Fiche rapprochée d'ICS (${c.icsType ?? "ICS"})`} style={{ background: "#1C7A4A18", color: "#1C7A4A", borderRadius: 6, padding: "3px 8px", fontSize: 10.5, fontWeight: 700, flexShrink: 0 }}>ICS ✓</span>
                    )}
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      {c.email && <a href={`/messagerie?to=${encodeURIComponent(c.email)}`} title="Envoyer un mail depuis la messagerie" style={iconBtn}>✉</a>}
                      {c.phone && <a href={`tel:${c.phone}`} title="Appeler" style={iconBtn}>📞</a>}
                      {c.icsRef && <a href={`/ics?recherche=${encodeURIComponent(contactName(c))}`} title="Documents ICS (GED)" style={iconBtn}>📁</a>}
                      <button onClick={() => setTaskFor(c)} title="Créer une tâche liée" style={iconBtnBtn}>✅</button>
                      <button onClick={() => setRdvFor(c)} title="Créer un rendez-vous lié" style={iconBtnBtn}>📅</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        </div>
      </div>

      {showAdd && <AddContactModal categories={categories} onClose={() => setShowAdd(false)} onSaved={() => { setShowAdd(false); load(); }} />}
      {showCats && <CategoryManagerModal categories={categories} onClose={() => setShowCats(false)} onChange={setCategories} />}
      {taskFor && <TaskFromContactModal contact={taskFor} onClose={() => setTaskFor(null)} />}
      {rdvFor  && <RdvFromContactModal  contact={rdvFor}  onClose={() => setRdvFor(null)} />}
    </div>
  );
}

function TaskFromContactModal({ contact, onClose }: { contact: Contact; onClose: () => void }) {
  const name = contactName(contact);
  const [title, setTitle] = useState(`Suivi — ${name}`);
  const [description, setDescription] = useState(contact.email ? `Contact : ${contact.email}` : "");
  const [priority, setPriority] = useState("moyenne");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    if (!title.trim()) return;
    setSaving(true); setErr("");
    try {
      const r = await fetch("/api/tasks", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), description, priority, dueDate: dueDate || null, tags: [`contact:${contact.id}`] }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); setErr(d.error || "Erreur"); return; }
      setDone(true); setTimeout(onClose, 900);
    } catch { setErr("Erreur réseau"); }
    finally { setSaving(false); }
  }

  return (
    <ModalShell title={`✅ Nouvelle tâche — ${name}`} onClose={onClose}>
      <L label="Titre"><input value={title} onChange={e => setTitle(e.target.value)} style={inp} /></L>
      <L label="Description"><input value={description} onChange={e => setDescription(e.target.value)} style={inp} /></L>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <L label="Priorité">
          <select value={priority} onChange={e => setPriority(e.target.value)} style={inp}>
            <option value="urgent">Urgente</option><option value="haute">Haute</option>
            <option value="moyenne">Moyenne</option><option value="basse">Basse</option>
          </select>
        </L>
        <L label="Échéance"><input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={inp} /></L>
      </div>
      {err && <span style={{ color: "#dc2626", fontSize: 12 }}>{err}</span>}
      <button onClick={save} disabled={saving || done} style={saveBtn}>{done ? "✓ Créée" : saving ? "Création…" : "Créer la tâche"}</button>
    </ModalShell>
  );
}

function RdvFromContactModal({ contact, onClose }: { contact: Contact; onClose: () => void }) {
  const name = contactName(contact);
  const [title, setTitle] = useState(`RDV — ${name}`);
  const [start, setStart] = useState("");
  const [duration, setDuration] = useState("30");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    if (!title.trim() || !start) { setErr("Titre et date/heure requis"); return; }
    setSaving(true); setErr("");
    try {
      const startD = new Date(start);
      const endD = new Date(startD.getTime() + parseInt(duration, 10) * 60000);
      const r = await fetch("/api/calendar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(), location, start: startD.toISOString(), end: endD.toISOString(), type: "rdv",
          attendees: [{ type: "contact", id: contact.id, name, email: contact.email ?? undefined }],
        }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); setErr(d.error || "Erreur"); return; }
      setDone(true); setTimeout(onClose, 900);
    } catch { setErr("Erreur réseau"); }
    finally { setSaving(false); }
  }

  return (
    <ModalShell title={`📅 Nouveau rendez-vous — ${name}`} onClose={onClose}>
      <L label="Titre"><input value={title} onChange={e => setTitle(e.target.value)} style={inp} /></L>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 12 }}>
        <L label="Début"><input type="datetime-local" value={start} onChange={e => setStart(e.target.value)} style={inp} /></L>
        <L label="Durée">
          <select value={duration} onChange={e => setDuration(e.target.value)} style={inp}>
            <option value="15">15 min</option><option value="30">30 min</option>
            <option value="60">1 h</option><option value="90">1 h 30</option><option value="120">2 h</option>
          </select>
        </L>
      </div>
      <L label="Lieu"><input value={location} onChange={e => setLocation(e.target.value)} placeholder="Adresse ou visio" style={inp} /></L>
      {err && <span style={{ color: "#dc2626", fontSize: 12 }}>{err}</span>}
      <button onClick={save} disabled={saving || done} style={saveBtn}>{done ? "✓ Créé" : saving ? "Création…" : "Créer le rendez-vous"}</button>
    </ModalShell>
  );
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: 460, maxWidth: "92vw", maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ background: DARK, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>{title}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#9ca3af", fontSize: 20, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>
      </div>
    </div>
  );
}

function AddContactModal({ categories, onClose, onSaved }: { categories: ContactCategory[]; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ type: categories[0]?.id ?? "autre", prenom: "", nom: "", raisonSociale: "", email: "", phone: "", note: "" });
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
              {categories.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
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

function CategoryManagerModal({ categories, onClose, onChange }: { categories: ContactCategory[]; onClose: () => void; onChange: (c: ContactCategory[]) => void }) {
  const [label, setLabel] = useState("");
  const [color, setColor] = useState("#6B7280");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const PALETTE = ["#0EA5E9", "#8B5CF6", "#10B981", "#B8966A", "#F59E0B", "#EF4444", "#EC4899", "#6B7280"];

  async function add() {
    if (!label.trim()) return;
    setSaving(true); setErr("");
    try {
      const r = await fetch("/api/contacts/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: label.trim(), color }) });
      const d = await r.json();
      if (!r.ok) { setErr(d.error || "Erreur"); return; }
      onChange(d.categories); setLabel("");
    } catch { setErr("Erreur réseau"); }
    finally { setSaving(false); }
  }

  async function remove(id: string) {
    const r = await fetch(`/api/contacts/categories?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const d = await r.json();
    if (r.ok) onChange(d.categories);
  }

  return (
    <ModalShell title="🏷 Catégories de contacts" onClose={onClose}>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 6 }}>
        {categories.map(c => (
          <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 4px", borderBottom: "1px solid #f3f4f6" }}>
            <span style={{ width: 12, height: 12, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: 13, color: DARK }}>{c.label}</span>
            {c.custom
              ? <button onClick={() => remove(c.id)} title="Supprimer" style={{ background: "none", border: "none", color: "#d1d5db", fontSize: 16, cursor: "pointer" }}>×</button>
              : <span style={{ fontSize: 10, color: "#9ca3af" }}>par défaut</span>}
          </div>
        ))}
      </div>
      <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 6, textTransform: "uppercase" }}>Nouvelle catégorie</div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Nom de la catégorie" style={{ ...inp, flex: 1 }} />
          <button onClick={add} disabled={saving || !label.trim()} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "0 14px", height: 36, fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>{saving ? "…" : "Ajouter"}</button>
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          {PALETTE.map(c => (
            <button key={c} onClick={() => setColor(c)} style={{ width: 22, height: 22, borderRadius: "50%", background: c, border: color === c ? `2px solid ${DARK}` : "2px solid transparent", cursor: "pointer", padding: 0 }} />
          ))}
        </div>
        {err && <span style={{ color: "#dc2626", fontSize: 12, display: "block", marginTop: 6 }}>{err}</span>}
      </div>
    </ModalShell>
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
const iconBtnBtn: React.CSSProperties = { ...iconBtn, cursor: "pointer" };
const exportRow: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, padding: "6px 4px", fontSize: 13, color: "#1C1A17", cursor: "pointer" };
const saveBtn: React.CSSProperties = { background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "10px 0", fontSize: 14, fontWeight: 600, cursor: "pointer", marginTop: 4 };
