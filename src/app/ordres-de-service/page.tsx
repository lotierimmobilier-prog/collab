"use client";
import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";

const GOLD = "#B8966A"; const BORDER = "#E6E1D9"; const DARK = "#1C1A17"; const GOLD_BG = "#F7F0E6"; const GREEN = "#2F855A";

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
  createdAt: string; sentAt?: string | null;
  supplier?: { name: string; type: string; phone?: string; email?: string };
}

interface SupplierLite { id: string; name: string; type: string; metier?: string; email?: string; phone?: string }

export default function ODSPage() {
  const [orders, setOrders]     = useState<ODS[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filterStatus, setFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [suppliers, setSuppliers] = useState<SupplierLite[]>([]);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/ods");
    if (r.ok) setOrders(await r.json());
    setLoading(false);
  }

  async function loadSuppliers() {
    const r = await fetch("/api/fournisseurs");
    if (r.ok) setSuppliers(await r.json());
  }

  useEffect(() => { load(); loadSuppliers(); }, []);

  async function createOds(data: Record<string, unknown>) {
    const r = await fetch("/api/ods", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    if (r.ok) { await load(); setShowForm(false); return true; }
    const d = await r.json().catch(() => ({}));
    alert(d.error || "Création impossible.");
    return false;
  }

  async function updateStatus(id: string, status: string) {
    const r = await fetch(`/api/ods/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (r.ok) setOrders(p => p.map(o => o.id === id ? { ...o, status } : o));
  }

  const [sending, setSending] = useState<string | null>(null);
  async function sendToSupplier(o: ODS) {
    if (!o.supplier?.email) { alert("Ce fournisseur n'a pas d'adresse email."); return; }
    if (!confirm(`Envoyer l'ordre de service ${o.ref} par email à ${o.supplier.name} (${o.supplier.email}) ?`)) return;
    setSending(o.id);
    try {
      const r = await fetch(`/api/ods/${o.id}/send`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) { alert(d.error || "Envoi échoué."); return; }
      setOrders(p => p.map(x => x.id === o.id ? { ...x, ...d.order } : x));
      alert(`Ordre de service envoyé à ${d.sentTo}.`);
    } catch { alert("Erreur réseau."); }
    finally { setSending(null); }
  }

  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = filterStatus === "all" ? orders : orders.filter(o => o.status === filterStatus);
  const countByStatus = (s: string) => orders.filter(o => o.status === s).length;

  return (
    <div style={{ display: "flex", height: "100vh", background: "#f9fafb", fontFamily: "'Inter', sans-serif" }}>
      <Sidebar active="ods" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "14px 24px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: 0 }}>📋 Ordres de service</h1>
            <p style={{ fontSize: 12, color: "#6b7280", margin: "2px 0 0" }}>{orders.length} ordre(s) au total</p>
          </div>
          <button onClick={() => setShowForm(true)} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
            + Nouvel ordre de service
          </button>
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
              <div style={{ fontSize: 13, marginTop: 6 }}>Cliquez sur « + Nouvel ordre de service » ou créez-en depuis une tâche</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {filtered.map(o => {
                const st = ODS_STATUS[o.status] ?? { label: o.status, color: "#6b7280" };
                return (
                 <div key={o.id}>
                  <div style={{ background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, padding: "14px 16px", display: "flex", gap: 14, alignItems: "flex-start" }}>
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
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end", flexShrink: 0 }}>
                      <select value={o.status} onChange={e => updateStatus(o.id, e.target.value)} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "5px 8px", fontSize: 12, background: "#f9fafb", outline: "none", cursor: "pointer" }}>
                        {Object.entries(ODS_STATUS).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
                      </select>
                      <button onClick={() => sendToSupplier(o)} disabled={sending === o.id || !o.supplier?.email}
                        title={!o.supplier?.email ? "Le fournisseur n'a pas d'email" : "Envoyer l'ODS par email au fournisseur"}
                        style={{ border: `1px solid ${GOLD}`, color: o.supplier?.email ? GOLD : "#9ca3af", background: "#fff", borderRadius: 8, padding: "5px 10px", fontSize: 12, cursor: o.supplier?.email ? "pointer" : "default", whiteSpace: "nowrap" }}>
                        {sending === o.id ? "Envoi…" : o.sentAt ? "↻ Renvoyer" : "✉️ Envoyer"}
                      </button>
                      <button onClick={() => setExpanded(e => e === o.id ? null : o.id)}
                        style={{ border: `1px solid ${BORDER}`, color: DARK, background: "#fff", borderRadius: 8, padding: "5px 10px", fontSize: 12, cursor: "pointer", whiteSpace: "nowrap" }}>
                        💬 {expanded === o.id ? "Fermer" : "Échanges"}
                      </button>
                    </div>
                  </div>
                  {expanded === o.id && <OdsExchange odsId={o.id} />}
                 </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showForm && <NewOdsForm suppliers={suppliers} onClose={() => setShowForm(false)} onSave={createOds} />}
    </div>
  );
}

const ROLES = [
  { value: "locataire", label: "Locataire" },
  { value: "coproprietaire", label: "Copropriétaire" },
  { value: "proprietaire", label: "Propriétaire" },
  { value: "gardien", label: "Gardien" },
  { value: "autre", label: "Autre" },
];

function NewOdsForm({ suppliers, onClose, onSave }: { suppliers: SupplierLite[]; onClose: () => void; onSave: (d: Record<string, unknown>) => Promise<boolean> }) {
  const [f, setF] = useState({
    supplierId: "", title: "", interventionType: "", description: "", address: "",
    deadline: "", amount: "", urgency: "normal", quoteRequired: false,
    onSiteName: "", onSitePhone: "", onSiteRole: "locataire", keyAtAgency: false,
    accessInfo: "", agentName: "", agentPhone: "",
  });
  const [saving, setSaving] = useState(false);
  function set(k: string, v: string | boolean) { setF(p => ({ ...p, [k]: v })); }

  // À la sélection du fournisseur, pré-remplit le type d'intervention.
  function pickSupplier(id: string) {
    const s = suppliers.find(x => x.id === id);
    setF(p => ({ ...p, supplierId: id, interventionType: p.interventionType || s?.metier || s?.type || "" }));
  }

  const supplier = suppliers.find(s => s.id === f.supplierId);

  async function submit() {
    if (!f.supplierId || !f.title.trim()) return;
    setSaving(true);
    const ok = await onSave({
      ...f,
      amount: f.amount ? parseFloat(f.amount) : undefined,
      deadline: f.deadline || undefined,
      urgency: f.urgency,
    });
    setSaving(false);
    if (!ok) return;
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 40 }} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 560, maxWidth: "100vw", background: "#fff", zIndex: 50, display: "flex", flexDirection: "column", boxShadow: "-4px 0 24px rgba(0,0,0,0.1)" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: DARK }}>Nouvel ordre de service</span>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer" }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <Fld label="Fournisseur *">
            <select value={f.supplierId} onChange={e => pickSupplier(e.target.value)} style={odsInp}>
              <option value="">— Choisir un fournisseur —</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}{s.metier ? ` · ${s.metier}` : s.type ? ` · ${s.type}` : ""}</option>)}
            </select>
          </Fld>
          {supplier && !supplier.email && <div style={{ fontSize: 11.5, color: "#b45309", marginTop: -8 }}>⚠ Ce fournisseur n'a pas d'email — vous pourrez créer l'ODS mais pas l'envoyer tant que l'email n'est pas renseigné.</div>}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Fld label="Objet *"><input autoFocus value={f.title} onChange={e => set("title", e.target.value)} style={odsInp} placeholder="Fuite sous évier" /></Fld>
            <Fld label="Type d'intervention"><input value={f.interventionType} onChange={e => set("interventionType", e.target.value)} style={odsInp} placeholder="Plomberie" /></Fld>
          </div>

          <Fld label="Lieu / adresse"><input value={f.address} onChange={e => set("address", e.target.value)} style={odsInp} placeholder="12 rue des Fleurs, Apt 3, 34000 Montpellier" /></Fld>

          <Fld label="Description"><textarea value={f.description} onChange={e => set("description", e.target.value)} rows={3} style={{ ...odsInp, height: "auto", padding: "8px 10px", resize: "vertical" }} placeholder="Détails de l'intervention demandée…" /></Fld>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <Fld label="Délai souhaité"><input type="date" value={f.deadline} onChange={e => set("deadline", e.target.value)} style={odsInp} /></Fld>
            <Fld label="Montant / plafond (€)"><input type="number" value={f.amount} onChange={e => set("amount", e.target.value)} style={odsInp} placeholder="ex. 350" /></Fld>
            <Fld label="Urgence">
              <select value={f.urgency} onChange={e => set("urgency", e.target.value)} style={odsInp}>
                <option value="normal">Normale</option>
                <option value="urgent">Urgent</option>
              </select>
            </Fld>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: DARK, cursor: "pointer" }}>
            <input type="checkbox" checked={f.quoteRequired} onChange={e => set("quoteRequired", e.target.checked)} /> Devis obligatoire avant intervention
          </label>

          <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 12, fontSize: 12, fontWeight: 700, color: "#6b7280" }}>CONTACT SUR PLACE</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
            <Fld label="Nom"><input value={f.onSiteName} onChange={e => set("onSiteName", e.target.value)} style={odsInp} placeholder="Mme Martin" /></Fld>
            <Fld label="Téléphone"><input value={f.onSitePhone} onChange={e => set("onSitePhone", e.target.value)} style={odsInp} placeholder="06 12 34 56 78" /></Fld>
            <Fld label="Qualité">
              <select value={f.onSiteRole} onChange={e => set("onSiteRole", e.target.value)} style={odsInp}>
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </Fld>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: DARK, cursor: "pointer" }}>
            <input type="checkbox" checked={f.keyAtAgency} onChange={e => set("keyAtAgency", e.target.checked)} /> Logement non loué — clés à retirer à l'agence
          </label>
          <Fld label="Infos d'accès"><input value={f.accessInfo} onChange={e => set("accessInfo", e.target.value)} style={odsInp} placeholder="Digicode 12A34, 2e étage, porte droite" /></Fld>

          <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 12, fontSize: 12, fontWeight: 700, color: "#6b7280" }}>AGENT RÉFÉRENT</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Fld label="Nom"><input value={f.agentName} onChange={e => set("agentName", e.target.value)} style={odsInp} placeholder="Laissé vide = vous" /></Fld>
            <Fld label="Téléphone"><input value={f.agentPhone} onChange={e => set("agentPhone", e.target.value)} style={odsInp} placeholder="04 67 00 00 00" /></Fld>
          </div>
        </div>

        <div style={{ padding: "14px 20px", borderTop: `1px solid ${BORDER}`, display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>Annuler</button>
          <button onClick={submit} disabled={!f.supplierId || !f.title.trim() || saving} style={{ background: (!f.supplierId || !f.title.trim()) ? "#e5e7eb" : GOLD, color: (!f.supplierId || !f.title.trim()) ? "#9ca3af" : "#fff", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
            {saving ? "Création…" : "Créer l'ODS"}
          </button>
        </div>
      </div>
    </>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 5 }}>{label}</div>{children}</div>;
}
const odsInp: React.CSSProperties = { width: "100%", minHeight: 36, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "7px 10px", fontSize: 13, outline: "none", background: "#f9fafb", fontFamily: "inherit", boxSizing: "border-box" };

interface FileMeta { id: string; kind?: string; name: string; mime?: string; at?: string; by?: string }
interface Msg { id: string; author: string; name: string; body: string; at: string }
interface Detail { supplierToken?: string; photos: FileMeta[]; files: FileMeta[]; messages: Msg[] }

function OdsExchange({ odsId }: { odsId: string }) {
  const [d, setD] = useState<Detail | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(`/api/ods/${odsId}`);
    if (r.ok) setD(await r.json());
  }, [odsId]);
  useEffect(() => { load(); }, [load]);

  async function post(payload: Record<string, unknown>) {
    setBusy(true);
    try {
      const r = await fetch(`/api/ods/${odsId}/exchange`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (r.ok) await load();
    } finally { setBusy(false); }
  }
  async function sendMsg() { if (msg.trim() && await post({ action: "message", body: msg })) setMsg(""); }
  async function upload(kind: string, fl: FileList | null) {
    if (!fl) return;
    const files: { name: string; mime: string; size: number; data: string }[] = [];
    for (const file of Array.from(fl).slice(0, 12)) {
      if (file.size > 10 * 1024 * 1024) continue;
      const data = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] || ""); r.onerror = rej; r.readAsDataURL(file); });
      files.push({ name: file.name, mime: file.type || "application/octet-stream", size: file.size, data });
    }
    if (files.length) await post({ action: "files", kind, files });
  }

  const portal = d?.supplierToken ? `${typeof window !== "undefined" ? window.location.origin : ""}/intervention/${d.supplierToken}` : "";

  return (
    <div style={{ background: "#FBFAF8", border: `1px solid ${BORDER}`, borderTop: "none", borderRadius: "0 0 12px 12px", margin: "-4px 0 0", padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
      {portal && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", fontSize: 12 }}>
          <span style={{ color: "#6b7280" }}>Lien fournisseur :</span>
          <span style={{ color: DARK, wordBreak: "break-all", flex: 1, minWidth: 0 }}>{portal}</span>
          <button onClick={() => navigator.clipboard?.writeText(portal)} style={miniBtn}>Copier</button>
        </div>
      )}

      {/* Pièces déposées */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: DARK, marginBottom: 6 }}>Pièces (devis, factures, photos)</div>
        {d && d.files.length === 0 && <div style={{ fontSize: 12, color: "#9ca3af" }}>Aucune pièce déposée.</div>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {d?.files.map(f => (
            <a key={f.id} href={`/api/ods/${odsId}?download=${f.id}`} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "6px 9px", fontSize: 12, color: DARK, textDecoration: "none", background: "#fff" }}>
              <span>{f.kind === "devis" ? "📄" : f.kind === "facture" ? "🧾" : "📷"}</span>{f.name}
              {f.by && <span style={{ color: "#9ca3af", fontSize: 10 }}>· {f.by}</span>}
            </a>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
          {[["devis", "📄 Devis"], ["facture", "🧾 Facture"], ["photo", "📷 Photo"]].map(([k, l]) => (
            <label key={k} style={{ ...miniBtn, cursor: "pointer" }}>{l}<input type="file" multiple accept="image/*,.pdf" style={{ display: "none" }} onChange={e => { upload(k, e.target.files); e.target.value = ""; }} /></label>
          ))}
        </div>
      </div>

      {/* Fil */}
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: DARK, marginBottom: 6 }}>Échanges</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto", marginBottom: 8 }}>
          {d && d.messages.length === 0 && <div style={{ fontSize: 12, color: "#9ca3af" }}>Aucun message.</div>}
          {d?.messages.map(m => (
            <div key={m.id} style={{ alignSelf: m.author === "agence" ? "flex-end" : "flex-start", maxWidth: "85%", background: m.author === "agence" ? GOLD_BG : "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "7px 10px" }}>
              <div style={{ fontSize: 10.5, color: "#9ca3af" }}>{m.name} · {new Date(m.at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</div>
              <div style={{ fontSize: 13, color: DARK, whiteSpace: "pre-wrap" }}>{m.body}</div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <input value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={e => { if (e.key === "Enter") sendMsg(); }} placeholder="Répondre au fournisseur…" style={{ flex: 1, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, outline: "none" }} />
          <button onClick={sendMsg} disabled={busy || !msg.trim()} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "0 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Envoyer</button>
        </div>
      </div>
    </div>
  );
}

const miniBtn: React.CSSProperties = { border: `1px solid ${BORDER}`, background: "#fff", color: DARK, borderRadius: 7, padding: "5px 9px", fontSize: 12, cursor: "pointer" };
void GREEN;

function Pill({ label, count, active, color, onClick }: { label: string; count: number; active: boolean; color?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ background: active ? (color || GOLD) : "#f3f4f6", color: active ? "#fff" : (color || "#374151"), border: "none", borderRadius: 20, padding: "4px 12px", fontSize: 12, cursor: "pointer", fontWeight: active ? 600 : 400 }}>
      {label} <span style={{ opacity: 0.7 }}>({count})</span>
    </button>
  );
}
