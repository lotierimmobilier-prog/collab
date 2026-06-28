"use client";
import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Sidebar from "@/components/Sidebar";

const GOLD = "#B8966A"; const BORDER = "#E6E1D9"; const DARK = "#1C1A17"; const GOLD_BG = "#F7F0E6";
const RED = "#DC2626"; const AMBER = "#B45309"; const GREEN = "#2F855A";

interface KindDef { value: string; label: string; icon: string; hasExpiry: boolean; hasNumber?: boolean; hasHours?: boolean }
const DOC_KINDS: KindDef[] = [
  { value: "carte_pro",      label: "Carte professionnelle",          icon: "🪪", hasExpiry: true,  hasNumber: true },
  { value: "assurance_pro",  label: "Assurance pro (RCP / garantie)", icon: "🛡", hasExpiry: true,  hasNumber: true },
  { value: "alur",           label: "Formation ALUR",                 icon: "🎓", hasExpiry: true,  hasHours: true },
  { value: "piece_identite", label: "Pièce d'identité",               icon: "🪪", hasExpiry: true,  hasNumber: true },
  { value: "rib",            label: "RIB",                            icon: "🏦", hasExpiry: false },
  { value: "autre",          label: "Autre document",                 icon: "📄", hasExpiry: false },
];
function kindInfo(v: string): KindDef { return DOC_KINDS.find(k => k.value === v) ?? { value: v, label: v, icon: "📄", hasExpiry: false }; }

type Status = "ok" | "soon" | "expired" | "none";
function statusOf(expiresAt?: string | null): Status {
  if (!expiresAt) return "none";
  const days = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 86_400_000);
  if (isNaN(days)) return "none";
  return days < 0 ? "expired" : days <= 30 ? "soon" : "ok";
}
const STATUS_UI: Record<Status, { label: string; color: string }> = {
  ok:      { label: "Valide",         color: GREEN },
  soon:    { label: "Expire bientôt", color: AMBER },
  expired: { label: "Expiré",         color: RED },
  none:    { label: "—",              color: "#9ca3af" },
};

function fileToB64(file: File): Promise<{ name: string; mime: string; size: number; data: string }> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res({ name: file.name, mime: file.type || "application/octet-stream", size: file.size, data: String(r.result).split(",")[1] || "" });
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

interface Doc { id: string; kind: string; label?: string; number?: string; issuer?: string; issuedAt?: string | null; expiresAt?: string | null; alurHours?: number | null; fileName?: string; hasFile?: boolean }

export default function MonEspacePage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.roleId === "admin";
  const [tab, setTab] = useState<"docs" | "drive" | "compliance">("docs");

  return (
    <div style={{ display: "flex", height: "100vh", background: "#f9fafb", fontFamily: "'Inter', sans-serif" }}>
      <Sidebar active="espace" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ background: "#fff", borderBottom: `1px solid ${BORDER}`, padding: "14px 24px" }}>
          <h1 style={{ fontSize: 16, fontWeight: 700, color: DARK, margin: 0 }}>🗂 Mon espace</h1>
          <p style={{ fontSize: 12, color: "#6b7280", margin: "2px 0 0" }}>Vos documents administratifs et votre drive personnel — visibles de vous seul.</p>
        </div>
        <div style={{ background: "#fff", borderBottom: `1px solid ${BORDER}`, padding: "0 24px", display: "flex", gap: 4 }}>
          <Tab label="Documents administratifs" active={tab === "docs"} onClick={() => setTab("docs")} />
          <Tab label="Mon Drive" active={tab === "drive"} onClick={() => setTab("drive")} />
          {isAdmin && <Tab label="Conformité (équipe)" active={tab === "compliance"} onClick={() => setTab("compliance")} />}
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          {tab === "docs" && <DocsTab />}
          {tab === "drive" && <DriveTab />}
          {tab === "compliance" && isAdmin && <ComplianceTab />}
        </div>
      </div>
    </div>
  );
}

function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{ background: "none", border: "none", borderBottom: `2px solid ${active ? GOLD : "transparent"}`, color: active ? DARK : "#6b7280", fontWeight: active ? 600 : 500, fontSize: 13, padding: "12px 14px", cursor: "pointer" }}>
      {label}
    </button>
  );
}

// ── Onglet Documents administratifs ────────────────────────────────
function DocsTab() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Doc | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/me/legal-documents");
    if (r.ok) setDocs(await r.json());
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function remove(id: string) {
    if (!confirm("Supprimer ce document ?")) return;
    await fetch(`/api/me/legal-documents/${id}`, { method: "DELETE" });
    await load();
  }

  const alerts = docs.filter(d => ["soon", "expired"].includes(statusOf(d.expiresAt)));

  return (
    <div style={{ maxWidth: 860 }}>
      {alerts.length > 0 && (
        <div style={{ background: "#FEF2F2", border: `1px solid #FECACA`, borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#991B1B" }}>
          ⚠ {alerts.length} document(s) à renouveler : {alerts.map(a => `${kindInfo(a.kind).label} (${STATUS_UI[statusOf(a.expiresAt)].label.toLowerCase()})`).join(", ")}.
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
        <div style={{ flex: 1, fontSize: 13, color: "#6b7280" }}>Assurance pro, carte professionnelle (avec validité), formation ALUR, RIB…</div>
        <button onClick={() => { setEditing(null); setShowForm(true); }} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
          + Ajouter un document
        </button>
      </div>

      {loading ? <div style={{ color: "#9ca3af", padding: 40, textAlign: "center" }}>Chargement…</div>
       : docs.length === 0 ? <div style={{ color: "#9ca3af", padding: 40, textAlign: "center" }}>Aucun document. Ajoutez votre carte pro, votre assurance, votre attestation ALUR…</div>
       : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {docs.map(d => {
            const ki = kindInfo(d.kind); const st = statusOf(d.expiresAt); const su = STATUS_UI[st];
            return (
              <div key={d.id} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "12px 16px", display: "flex", gap: 14, alignItems: "center" }}>
                <div style={{ fontSize: 22, width: 30, textAlign: "center" }}>{ki.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: DARK }}>{ki.label}{d.label ? ` — ${d.label}` : ""}</div>
                  <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2, display: "flex", gap: 12, flexWrap: "wrap" }}>
                    {d.number && <span>N° {d.number}</span>}
                    {d.issuer && <span>{d.issuer}</span>}
                    {d.alurHours != null && <span>{d.alurHours} h ALUR</span>}
                    {d.expiresAt && <span>Validité : {new Date(d.expiresAt).toLocaleDateString("fr-FR")}</span>}
                  </div>
                </div>
                {d.expiresAt && <span style={{ background: su.color + "20", color: su.color, borderRadius: 6, padding: "2px 9px", fontSize: 11.5, fontWeight: 600 }}>{su.label}</span>}
                {d.hasFile && <a href={`/api/me/legal-documents/${d.id}`} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: GOLD, textDecoration: "none", border: `1px solid ${BORDER}`, borderRadius: 7, padding: "5px 9px" }}>📎 Voir</a>}
                <button onClick={() => { setEditing(d); setShowForm(true); }} style={miniBtn}>✏</button>
                <button onClick={() => remove(d.id)} style={{ ...miniBtn, color: RED, borderColor: "#fecaca" }}>✕</button>
              </div>
            );
          })}
        </div>
      )}

      {showForm && <DocForm doc={editing} onClose={() => { setShowForm(false); setEditing(null); }} onSaved={async () => { setShowForm(false); setEditing(null); await load(); }} />}
    </div>
  );
}

function DocForm({ doc, onClose, onSaved, admin }: { doc: Doc | null; onClose: () => void; onSaved: () => void; admin?: { userId: string } }) {
  const [f, setF] = useState({
    kind: doc?.kind ?? "carte_pro", label: doc?.label ?? "", number: doc?.number ?? "", issuer: doc?.issuer ?? "",
    issuedAt: doc?.issuedAt ? doc.issuedAt.slice(0, 10) : "", expiresAt: doc?.expiresAt ? doc.expiresAt.slice(0, 10) : "",
    alurHours: doc?.alurHours != null ? String(doc.alurHours) : "",
  });
  const [file, setFile] = useState<{ name: string; mime: string; size: number; data: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const ki = kindInfo(f.kind);
  function set(k: string, v: string) { setF(p => ({ ...p, [k]: v })); }

  async function submit() {
    setSaving(true);
    const payload = { ...f, alurHours: f.alurHours || undefined, file: file || undefined };
    // Côté agent : /api/me/* ; côté admin : endpoints admin (même table → synchro).
    const editUrl = admin ? `/api/admin/legal-documents/${doc?.id}` : `/api/me/legal-documents/${doc?.id}`;
    const createUrl = admin ? `/api/admin/users/${admin.userId}/legal-documents` : "/api/me/legal-documents";
    const r = doc
      ? await fetch(editUrl, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      : await fetch(createUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setSaving(false);
    if (r.ok) onSaved();
    else { const d = await r.json().catch(() => ({})); alert(d.error || "Échec."); }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 40 }} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 480, maxWidth: "100vw", background: "#fff", zIndex: 50, display: "flex", flexDirection: "column", boxShadow: "-4px 0 24px rgba(0,0,0,0.1)" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: DARK }}>{doc ? "Modifier le document" : "Nouveau document"}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <L label="Type de document">
            <select value={f.kind} onChange={e => set("kind", e.target.value)} style={inp} disabled={!!doc}>
              {DOC_KINDS.map(k => <option key={k.value} value={k.value}>{k.icon} {k.label}</option>)}
            </select>
          </L>
          <L label="Libellé (facultatif)"><input value={f.label} onChange={e => set("label", e.target.value)} style={inp} placeholder="ex. Carte T — transaction" /></L>
          {ki.hasNumber && <L label="Numéro"><input value={f.number} onChange={e => set("number", e.target.value)} style={inp} placeholder="N° de carte / police" /></L>}
          <L label="Émetteur (CCI, assureur, organisme)"><input value={f.issuer} onChange={e => set("issuer", e.target.value)} style={inp} /></L>
          {ki.hasHours && <L label="Heures de formation ALUR"><input type="number" value={f.alurHours} onChange={e => set("alurHours", e.target.value)} style={inp} placeholder="ex. 14" /></L>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <L label="Date de délivrance"><input type="date" value={f.issuedAt} onChange={e => set("issuedAt", e.target.value)} style={inp} /></L>
            {ki.hasExpiry && <L label="Date de validité / expiration"><input type="date" value={f.expiresAt} onChange={e => set("expiresAt", e.target.value)} style={inp} /></L>}
          </div>
          <L label={doc?.hasFile ? "Remplacer le fichier (PDF, photo…)" : "Fichier (PDF, photo…)"}>
            <input type="file" accept="image/*,.pdf" onChange={async e => { const fl = e.target.files?.[0]; if (fl) { if (fl.size > 20 * 1024 * 1024) { alert("Fichier trop volumineux (max 20 Mo)."); return; } setFile(await fileToB64(fl)); } }} style={{ fontSize: 13 }} />
            {file && <div style={{ fontSize: 12, color: GREEN, marginTop: 4 }}>✓ {file.name}</div>}
            {!file && doc?.hasFile && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Fichier actuel conservé si vous n'en choisissez pas un nouveau.</div>}
          </L>
        </div>
        <div style={{ padding: "14px 20px", borderTop: `1px solid ${BORDER}`, display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>Annuler</button>
          <button onClick={submit} disabled={saving} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>{saving ? "Enregistrement…" : "Enregistrer"}</button>
        </div>
      </div>
    </>
  );
}

// ── Onglet Drive ───────────────────────────────────────────────────
interface DriveItem { id: string; parentId: string | null; kind: string; name: string; mime?: string; size?: number; system?: boolean; readonly?: boolean; visibility?: string; sharedFrom?: string }
const VIS_LABEL: Record<string, string> = { gestionnaire: "Gestionnaires", direction: "Direction", tous: "Toute l'agence" };
function VisBadge({ v }: { v?: string }) {
  if (!v || v === "confidentiel") return null;
  return <span style={{ fontSize: 9.5, fontWeight: 700, color: "#2563eb", background: "#E8EEFB", borderRadius: 20, padding: "1px 7px", whiteSpace: "nowrap" }}>{VIS_LABEL[v] ?? v}</span>;
}

function DriveTab() {
  const [parentId, setParentId] = useState<string | null>(null);
  const [path, setPath] = useState<{ id: string; name: string }[]>([]);
  const [items, setItems] = useState<DriveItem[]>([]);
  const [shared, setShared] = useState<DriveItem[]>([]);
  const [hereReadonly, setHereReadonly] = useState(false);
  const [canManageCommon, setCanManageCommon] = useState(false);
  const [showCommon, setShowCommon] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (pid: string | null, readonly = false) => {
    setLoading(true);
    const r = await fetch(`/api/me/drive${pid ? `?parentId=${pid}` : ""}`);
    if (r.ok) { const d = await r.json(); setItems(d.items); setShared(d.shared ?? []); setPath(d.path); setParentId(d.parentId); setCanManageCommon(!!d.canManageCommon); }
    setHereReadonly(readonly);
    setLoading(false);
  }, []);
  useEffect(() => { load(null); }, [load]);

  const writable = !hereReadonly || canManageCommon;

  async function newFolder() {
    const name = prompt("Nom du dossier :");
    if (!name?.trim()) return;
    setBusy(true);
    await fetch("/api/me/drive", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "folder", name: name.trim(), parentId }) });
    setBusy(false); await load(parentId, hereReadonly);
  }
  async function upload(fl: FileList | null) {
    if (!fl) return;
    setBusy(true);
    for (const file of Array.from(fl)) {
      if (file.size > 20 * 1024 * 1024) { alert(`${file.name} : trop volumineux (max 20 Mo).`); continue; }
      const b = await fileToB64(file);
      await fetch("/api/me/drive", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "file", name: b.name, mime: b.mime, size: b.size, data: b.data, parentId }) });
    }
    setBusy(false); await load(parentId, hereReadonly);
  }
  async function rename(it: DriveItem) {
    const name = prompt("Renommer :", it.name);
    if (!name?.trim() || name === it.name) return;
    await fetch(`/api/me/drive/${it.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim() }) });
    await load(parentId, hereReadonly);
  }
  async function remove(it: DriveItem) {
    if (!confirm(it.kind === "folder" ? `Supprimer le dossier « ${it.name} » et tout son contenu ?` : `Supprimer « ${it.name} » ?`)) return;
    await fetch(`/api/me/drive/${it.id}`, { method: "DELETE" });
    await load(parentId, hereReadonly);
  }

  return (
    <div style={{ maxWidth: 980 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ flex: 1, fontSize: 13, color: "#6b7280", display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={() => load(null)} style={crumb}>🏠 Racine</button>
          {path.map(p => <span key={p.id} style={{ display: "flex", gap: 6, alignItems: "center" }}><span style={{ color: "#d1d5db" }}>/</span><button onClick={() => load(p.id)} style={crumb}>{p.name}</button></span>)}
        </div>
        {canManageCommon && <button onClick={() => setShowCommon(true)} style={{ background: "#fff", color: DARK, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 12px", fontSize: 13, cursor: "pointer" }}>🛡 Dossiers communs</button>}
        <button onClick={newFolder} disabled={busy || !writable} title={writable ? "" : "Dossier en lecture seule"} style={{ background: "#fff", color: writable ? GOLD : "#cbd5e1", border: `1px solid ${writable ? GOLD : BORDER}`, borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: writable ? "pointer" : "not-allowed" }}>📁 Nouveau dossier</button>
        <label style={{ background: writable ? GOLD : "#e5e7eb", color: "#fff", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: writable ? "pointer" : "not-allowed" }}>
          ⬆ Téléverser
          <input type="file" multiple disabled={!writable} style={{ display: "none" }} onChange={e => { upload(e.target.files); e.target.value = ""; }} />
        </label>
      </div>
      {hereReadonly && <div style={{ fontSize: 12, color: "#8a6d44", background: "#F7F0E6", borderRadius: 8, padding: "7px 12px", marginBottom: 10 }}>🔒 Dossier en lecture seule — seul le super administrateur peut y déposer des documents.</div>}

      {busy && <div style={{ fontSize: 12, color: GOLD, marginBottom: 8 }}>Transfert en cours…</div>}
      {loading ? <div style={{ color: "#9ca3af", padding: 40, textAlign: "center" }}>Chargement…</div>
       : (items.length === 0 && shared.length === 0) ? <div style={{ color: "#9ca3af", padding: 40, textAlign: "center" }}>Dossier vide.</div>
       : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
          {items.map(it => (
            <div key={it.id} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <div style={{ fontSize: 26 }}>{it.kind === "folder" ? (it.system ? "🗂" : "📁") : fileIcon(it.mime)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {it.kind === "folder"
                    ? <button onClick={() => load(it.id, it.readonly)} style={{ background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", fontWeight: 600, fontSize: 13, color: DARK, wordBreak: "break-word" }}>{it.name}</button>
                    : <a href={`/api/me/drive/${it.id}`} target="_blank" rel="noreferrer" style={{ fontWeight: 600, fontSize: 13, color: DARK, textDecoration: "none", wordBreak: "break-word" }}>{it.name}</a>}
                  <div style={{ display: "flex", gap: 5, alignItems: "center", marginTop: 3, flexWrap: "wrap" }}>
                    {it.kind === "file" && it.size != null && <span style={{ fontSize: 11, color: "#9ca3af" }}>{fmtSize(it.size)}</span>}
                    {it.kind === "folder" && <VisBadge v={it.visibility} />}
                    {it.system && <span style={{ fontSize: 9.5, color: "#9ca3af" }} title="Dossier imposé">🔒 imposé</span>}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                {it.kind === "file" && <a href={`/api/me/drive/${it.id}`} download style={{ ...miniBtn, textDecoration: "none", color: GOLD }}>⬇</a>}
                {!it.system && <button onClick={() => rename(it)} style={miniBtn}>✏</button>}
                {!it.system && <button onClick={() => remove(it)} style={{ ...miniBtn, color: RED, borderColor: "#fecaca" }}>✕</button>}
              </div>
            </div>
          ))}
          {shared.map(it => (
            <div key={`sh-${it.id}`} style={{ background: "#FbF9F5", border: `1px dashed ${GOLD}`, borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <div style={{ fontSize: 26 }}>{fileIcon(it.mime)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <a href={`/api/me/drive/${it.id}`} target="_blank" rel="noreferrer" style={{ fontWeight: 600, fontSize: 13, color: DARK, textDecoration: "none", wordBreak: "break-word" }}>{it.name}</a>
                  <div style={{ fontSize: 10.5, color: GOLD, marginTop: 2 }}>partagé · {it.sharedFrom}</div>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <a href={`/api/me/drive/${it.id}`} download style={{ ...miniBtn, textDecoration: "none", color: GOLD }}>⬇</a>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCommon && <CommonFoldersModal onClose={() => { setShowCommon(false); load(parentId, hereReadonly); }} />}
    </div>
  );
}

// Gestion des dossiers communs (super admin) — poussés sur tous les drives.
function CommonFoldersModal({ onClose }: { onClose: () => void }) {
  interface Tpl { id: string; name: string; visibility: string; readonly: boolean }
  const [list, setList] = useState<Tpl[]>([]);
  const [name, setName] = useState("");
  const [vis, setVis] = useState("confidentiel");
  const [ro, setRo] = useState(false);
  const load = useCallback(() => { fetch("/api/agency/drive/templates").then(r => r.ok ? r.json() : null).then(d => setList(d?.templates ?? [])).catch(() => {}); }, []);
  useEffect(() => { load(); }, [load]);
  async function add() {
    if (!name.trim()) return;
    await fetch("/api/agency/drive/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), visibility: vis, readonly: ro }) });
    setName(""); setVis("confidentiel"); setRo(false); load();
  }
  async function setVisOf(id: string, visibility: string) { await fetch("/api/agency/drive/templates", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, visibility }) }); load(); }
  async function del(id: string) { if (!confirm("Supprimer ce dossier commun de tous les drives (et son contenu) ?")) return; await fetch("/api/agency/drive/templates", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }); load(); }
  const inp: React.CSSProperties = { height: 38, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "0 10px", fontSize: 13, outline: "none", background: "#fff" };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: 540, maxWidth: "94vw", maxHeight: "88vh", overflow: "auto" }}>
        <div style={{ padding: "14px 18px", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: DARK }}>🛡 Dossiers communs — sur tous les drives</span>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af" }}>×</button>
        </div>
        <div style={{ padding: 18 }}>
          <div style={{ fontSize: 12.5, color: "#6b7280", marginBottom: 12 }}>Ces dossiers apparaissent sur le drive de chaque agent. Par défaut, le contenu reste confidentiel (chacun le sien) ; choisissez une visibilité pour le partager.</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
            {list.length === 0 && <div style={{ fontSize: 13, color: "#9ca3af" }}>Aucun dossier commun pour le moment.</div>}
            {list.map(t => (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 12px" }}>
                <span style={{ fontSize: 18 }}>🗂</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: DARK }}>{t.name}{t.readonly ? " · lecture seule" : ""}</div>
                </div>
                <select value={t.visibility} onChange={e => setVisOf(t.id, e.target.value)} style={{ ...inp, height: 32, fontSize: 12 }}>
                  <option value="confidentiel">Confidentiel</option><option value="gestionnaire">Gestionnaires</option><option value="direction">Direction</option><option value="tous">Toute l'agence</option>
                </select>
                <button onClick={() => del(t.id)} style={{ ...miniBtn, color: RED, borderColor: "#fecaca" }}>✕</button>
              </div>
            ))}
          </div>
          <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: GOLD, textTransform: "uppercase" }}>Ajouter un dossier commun</div>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Nom du dossier" style={inp} />
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <select value={vis} onChange={e => setVis(e.target.value)} style={inp}>
                <option value="confidentiel">Confidentiel (chacun le sien)</option><option value="gestionnaire">Gestionnaires</option><option value="direction">Direction</option><option value="tous">Toute l'agence</option>
              </select>
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: DARK }}><input type="checkbox" checked={ro} onChange={e => setRo(e.target.checked)} /> Lecture seule (rempli par le super admin)</label>
              <button onClick={add} disabled={!name.trim()} style={{ marginLeft: "auto", background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: name.trim() ? 1 : 0.5 }}>Ajouter</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function fileIcon(mime?: string) {
  if (!mime) return "📄";
  if (mime.startsWith("image/")) return "🖼";
  if (mime.includes("pdf")) return "📕";
  if (mime.includes("sheet") || mime.includes("excel") || mime.includes("csv")) return "📊";
  if (mime.includes("word") || mime.includes("document")) return "📘";
  return "📄";
}
function fmtSize(b: number) { return b > 1048576 ? `${(b / 1048576).toFixed(1)} Mo` : `${Math.max(1, Math.round(b / 1024))} Ko`; }

// ── Onglet Conformité (admin) ──────────────────────────────────────
interface CompRow { user: { id: string; prenom: string; nom: string; email: string; roleId: string }; docs: { id: string; kind: string; expiresAt: string | null; status: Status; hasFile: boolean }[]; worst: string }
function ComplianceTab() {
  const [rows, setRows] = useState<CompRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openUser, setOpenUser] = useState<CompRow["user"] | null>(null);
  const TRACK = ["carte_pro", "assurance_pro", "alur"];

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/legal-compliance");
    if (r.ok) { const d = await r.json(); setRows(d.users); }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading) return <div style={{ color: "#9ca3af", padding: 40, textAlign: "center" }}>Chargement…</div>;

  return (
    <div style={{ maxWidth: 980 }}>
      <p style={{ fontSize: 13, color: "#6b7280", marginTop: 0 }}>Suivi de la validité des documents légaux de l'équipe. Cliquez sur un collaborateur pour voir le détail et compléter ses documents (la saisie est partagée avec l'agent).</p>
      <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1fr 28px", background: GOLD_BG, padding: "10px 14px", fontSize: 11.5, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          <div>Collaborateur</div><div>Carte pro</div><div>Assurance pro</div><div>ALUR</div><div></div>
        </div>
        {rows.map(row => (
          <div key={row.user.id} onClick={() => setOpenUser(row.user)}
            style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1fr 28px", padding: "10px 14px", borderTop: `1px solid ${BORDER}`, alignItems: "center", cursor: "pointer" }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: DARK }}>{row.user.prenom} {row.user.nom}</div>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>{row.user.roleId}</div>
            </div>
            {TRACK.map(kind => {
              const d = row.docs.find(x => x.kind === kind);
              const st = d ? d.status : "missing";
              const ui = st === "missing" ? { label: "Absent", color: "#9ca3af" } : STATUS_UI[st as Status];
              return (
                <div key={kind} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ background: ui.color + "20", color: ui.color, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>{ui.label}</span>
                  {d?.expiresAt && <span style={{ fontSize: 10.5, color: "#9ca3af" }}>{new Date(d.expiresAt).toLocaleDateString("fr-FR")}</span>}
                </div>
              );
            })}
            <div style={{ color: "#9ca3af", textAlign: "right" }}>›</div>
          </div>
        ))}
      </div>

      {openUser && <AgentDetailDrawer user={openUser} onClose={() => setOpenUser(null)} onChanged={load} />}
    </div>
  );
}

// Détail d'un agent (côté admin) : infos + documents éditables. Les documents
// sont les mêmes enregistrements que côté agent → synchronisation automatique.
function AgentDetailDrawer({ user, onClose, onChanged }: { user: CompRow["user"] & { phone?: string; lastLogin?: string | null }; onClose: () => void; onChanged: () => void }) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [info, setInfo] = useState<{ email?: string; phone?: string; lastLogin?: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Doc | null>(null);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/admin/users/${user.id}/legal-documents`);
    if (r.ok) { const d = await r.json(); setDocs(d.docs); setInfo(d.user); }
    setLoading(false);
  }, [user.id]);
  useEffect(() => { load(); }, [load]);

  async function remove(id: string) {
    if (!confirm("Supprimer ce document ?")) return;
    await fetch(`/api/admin/legal-documents/${id}`, { method: "DELETE" });
    await load(); onChanged();
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 40 }} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 560, maxWidth: "100vw", background: "#fff", zIndex: 45, display: "flex", flexDirection: "column", boxShadow: "-4px 0 24px rgba(0,0,0,0.1)" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: DARK }}>{user.prenom} {user.nom}</div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 3 }}>
              {user.roleId}{info?.email ? ` · ${info.email}` : ""}{info?.phone ? ` · ${info.phone}` : ""}
            </div>
            {info?.lastLogin && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>Dernière connexion : {new Date(info.lastLogin).toLocaleDateString("fr-FR")}</div>}
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer" }}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          <div style={{ display: "flex", alignItems: "center", marginBottom: 12 }}>
            <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: DARK }}>Documents administratifs</div>
            <button onClick={() => { setEditing(null); setShowForm(true); }} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}>+ Ajouter</button>
          </div>

          {loading ? <div style={{ color: "#9ca3af", padding: 30, textAlign: "center" }}>Chargement…</div>
           : docs.length === 0 ? <div style={{ color: "#9ca3af", padding: 30, textAlign: "center", fontSize: 13 }}>Aucun document pour ce collaborateur.</div>
           : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {docs.map(d => {
                const ki = kindInfo(d.kind); const st = statusOf(d.expiresAt); const su = STATUS_UI[st];
                return (
                  <div key={d.id} style={{ background: "#FBFAF8", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 12px", display: "flex", gap: 10, alignItems: "center" }}>
                    <span style={{ fontSize: 18 }}>{ki.icon}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, color: DARK }}>{ki.label}{d.label ? ` — ${d.label}` : ""}</div>
                      <div style={{ fontSize: 11.5, color: "#6b7280", display: "flex", gap: 10, flexWrap: "wrap" }}>
                        {d.number && <span>N° {d.number}</span>}
                        {d.alurHours != null && <span>{d.alurHours} h</span>}
                        {d.expiresAt && <span>Validité : {new Date(d.expiresAt).toLocaleDateString("fr-FR")}</span>}
                      </div>
                    </div>
                    {d.expiresAt && <span style={{ background: su.color + "20", color: su.color, borderRadius: 6, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>{su.label}</span>}
                    {d.hasFile && <a href={`/api/admin/legal-documents/${d.id}`} target="_blank" rel="noreferrer" style={{ ...miniBtn, textDecoration: "none", color: GOLD }} title="Voir">📎</a>}
                    <button onClick={() => { setEditing(d); setShowForm(true); }} style={miniBtn}>✏</button>
                    <button onClick={() => remove(d.id)} style={{ ...miniBtn, color: RED, borderColor: "#fecaca" }}>✕</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showForm && <DocForm doc={editing} admin={{ userId: user.id }} onClose={() => { setShowForm(false); setEditing(null); }} onSaved={async () => { setShowForm(false); setEditing(null); await load(); onChanged(); }} />}
    </>
  );
}

const miniBtn: React.CSSProperties = { border: `1px solid ${BORDER}`, background: "#fff", color: DARK, borderRadius: 7, padding: "5px 9px", fontSize: 12, cursor: "pointer" };
const crumb: React.CSSProperties = { background: "none", border: "none", padding: 0, cursor: "pointer", color: GOLD, fontSize: 13, fontWeight: 500 };
const inp: React.CSSProperties = { width: "100%", minHeight: 38, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, outline: "none", background: "#f9fafb", fontFamily: "inherit", boxSizing: "border-box" };
function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 5 }}>{label}</div>{children}</div>;
}
