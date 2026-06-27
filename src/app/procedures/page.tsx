"use client";
import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Sidebar from "@/components/Sidebar";

const GOLD = "#B8966A"; const DARK = "#1C1A17"; const BORDER = "#E6E1D9"; const GOLD_BG = "#F7F0E6"; const RED = "#DC2626"; const GREEN = "#2F855A";

interface Procedure {
  id: string; title: string; description?: string; category?: string;
  kind: string; roles?: string[]; fileName?: string; mime?: string; size?: number; url?: string; hasFile?: boolean;
}

// Audiences ciblables (rôles). Vide = visible par tout le monde.
const AUDIENCE = [
  { id: "agent",        label: "Agent commercial" },
  { id: "gestionnaire", label: "Gestionnaire" },
  { id: "syndic",       label: "Syndic" },
  { id: "dirigeant",    label: "Direction" },
];
function audienceLabel(id: string) { return AUDIENCE.find(a => a.id === id)?.label ?? id; }

function fileToB64(file: File): Promise<{ name: string; mime: string; size: number; data: string }> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res({ name: file.name, mime: file.type || "application/octet-stream", size: file.size, data: String(r.result).split(",")[1] || "" });
    r.onerror = rej; r.readAsDataURL(file);
  });
}
// Convertit un lien YouTube/Vimeo en URL intégrable (sinon null).
function embedUrl(url?: string): string | null {
  if (!url) return null;
  const yt = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
}

export default function ProceduresPage() {
  const { data: session } = useSession();
  const isAdmin = session?.user?.roleId === "admin";
  const [items, setItems] = useState<Procedure[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Procedure | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/procedures");
    if (r.ok) setItems(await r.json());
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function remove(p: Procedure) {
    if (!confirm(`Supprimer la procédure « ${p.title} » ?`)) return;
    await fetch(`/api/procedures/${p.id}`, { method: "DELETE" });
    await load();
  }

  const cats = [...new Set(items.map(i => i.category || "Général"))];

  return (
    <div style={{ display: "flex", height: "100vh", background: "#f9fafb", fontFamily: "'Inter', sans-serif" }}>
      <Sidebar active="procedures" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ background: "#fff", borderBottom: `1px solid ${BORDER}`, padding: "14px 24px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 16, fontWeight: 700, color: DARK, margin: 0 }}>📚 Procédures d'entreprise</h1>
            <p style={{ fontSize: 12, color: "#6b7280", margin: "2px 0 0" }}>Documents et vidéos de référence{isAdmin ? "" : " — consultables par tous"}.</p>
          </div>
          {isAdmin && <button onClick={() => { setEditing(null); setShowForm(true); }} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>+ Ajouter une procédure</button>}
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          {loading ? <div style={{ textAlign: "center", color: "#9ca3af", padding: 60 }}>Chargement…</div>
           : items.length === 0 ? (
            <div style={{ textAlign: "center", color: "#9ca3af", padding: 60 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
              <div style={{ fontWeight: 600, color: "#374151" }}>Aucune procédure pour le moment</div>
              <div style={{ fontSize: 13, marginTop: 6 }}>{isAdmin ? "Ajoutez vos procédures (PDF ou vidéo)." : "L'administrateur n'a pas encore publié de procédure."}</div>
            </div>
          ) : (
            <div style={{ maxWidth: 960 }}>
              {cats.map(cat => (
                <div key={cat} style={{ marginBottom: 24 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: GOLD, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>{cat}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
                    {items.filter(i => (i.category || "Général") === cat).map(p => {
                      const isVideo = p.kind === "video" || (p.mime || "").startsWith("video/");
                      const emb = embedUrl(p.url);
                      const open = openId === p.id;
                      return (
                        <div key={p.id} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                            <div style={{ fontSize: 22 }}>{isVideo ? "🎬" : p.kind === "link" ? "🔗" : "📄"}</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 700, fontSize: 14, color: DARK }}>{p.title}</div>
                              {p.description && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2, lineHeight: 1.4 }}>{p.description}</div>}
                              {p.roles && p.roles.length > 0 && <div style={{ fontSize: 10.5, color: GOLD, marginTop: 3 }}>👥 {p.roles.map(audienceLabel).join(" · ")}</div>}
                            </div>
                            {isAdmin && (
                              <div style={{ display: "flex", gap: 4 }}>
                                <button onClick={() => { setEditing(p); setShowForm(true); }} style={miniBtn}>✏</button>
                                <button onClick={() => remove(p)} style={{ ...miniBtn, color: RED, borderColor: "#fecaca" }}>✕</button>
                              </div>
                            )}
                          </div>

                          {/* Lecteur / actions */}
                          {open && (isVideo && p.hasFile) && <video controls src={`/api/procedures/${p.id}`} style={{ width: "100%", borderRadius: 8, background: "#000" }} />}
                          {open && emb && <div style={{ position: "relative", paddingBottom: "56%", height: 0, borderRadius: 8, overflow: "hidden" }}><iframe src={emb} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }} /></div>}

                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
                            {p.hasFile && isVideo && <button onClick={() => setOpenId(open ? null : p.id)} style={actBtn}>{open ? "Masquer" : "▶ Regarder"}</button>}
                            {p.hasFile && !isVideo && <a href={`/api/procedures/${p.id}`} target="_blank" rel="noreferrer" style={{ ...actBtn, textDecoration: "none" }}>📄 Ouvrir le PDF</a>}
                            {p.hasFile && <a href={`/api/procedures/${p.id}`} download={p.fileName} style={{ ...miniBtn, textDecoration: "none", color: GOLD }}>⬇ Télécharger</a>}
                            {p.url && emb && <button onClick={() => setOpenId(open ? null : p.id)} style={actBtn}>{open ? "Masquer" : "▶ Regarder"}</button>}
                            {p.url && !emb && <a href={p.url} target="_blank" rel="noreferrer" style={{ ...actBtn, textDecoration: "none" }}>🔗 Ouvrir le lien</a>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showForm && isAdmin && <ProcForm proc={editing} onClose={() => { setShowForm(false); setEditing(null); }} onSaved={async () => { setShowForm(false); setEditing(null); await load(); }} />}
    </div>
  );
}

function ProcForm({ proc, onClose, onSaved }: { proc: Procedure | null; onClose: () => void; onSaved: () => void }) {
  const [f, setF] = useState({ title: proc?.title ?? "", description: proc?.description ?? "", category: proc?.category ?? "", url: proc?.url ?? "" });
  const [roles, setRoles] = useState<string[]>(proc?.roles ?? []);
  const [file, setFile] = useState<{ name: string; mime: string; size: number; data: string } | null>(null);
  const [saving, setSaving] = useState(false);
  function set(k: string, v: string) { setF(p => ({ ...p, [k]: v })); }
  function toggleRole(id: string) { setRoles(rs => rs.includes(id) ? rs.filter(r => r !== id) : [...rs, id]); }

  async function submit() {
    if (!f.title.trim()) return;
    setSaving(true);
    const payload = { ...f, roles, ...(file ? { file } : {}) };
    const r = proc
      ? await fetch(`/api/procedures/${proc.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      : await fetch("/api/procedures", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setSaving(false);
    if (r.ok) onSaved();
    else { const d = await r.json().catch(() => ({})); alert(d.error || "Échec."); }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 40 }} />
      <div style={{ position: "fixed", top: 0, right: 0, bottom: 0, width: 500, maxWidth: "100vw", background: "#fff", zIndex: 50, display: "flex", flexDirection: "column", boxShadow: "-4px 0 24px rgba(0,0,0,0.1)" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: DARK }}>{proc ? "Modifier la procédure" : "Nouvelle procédure"}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <L label="Titre *"><input autoFocus value={f.title} onChange={e => set("title", e.target.value)} style={inp} placeholder="Procédure d'état des lieux" /></L>
          <L label="Catégorie"><input value={f.category} onChange={e => set("category", e.target.value)} style={inp} placeholder="Gestion, Transaction, RH…" /></L>

          <L label="Destinataires (vide = tout le monde)">
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {AUDIENCE.map(a => {
                const on = roles.includes(a.id);
                return (
                  <button key={a.id} type="button" onClick={() => toggleRole(a.id)}
                    style={{ padding: "5px 11px", fontSize: 12, borderRadius: 20, cursor: "pointer", border: `1px solid ${on ? GOLD : BORDER}`, background: on ? GOLD_BG : "#fff", color: on ? GOLD : "#374151", fontWeight: on ? 600 : 400 }}>
                    {on ? "✓ " : ""}{a.label}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 5 }}>{roles.length === 0 ? "Visible par tout le monde." : `Visible par : ${roles.map(audienceLabel).join(", ")} (+ admin).`}</div>
          </L>

          <L label="Description"><textarea value={f.description} onChange={e => set("description", e.target.value)} rows={3} style={{ ...inp, height: "auto", padding: "8px 10px", resize: "vertical" }} placeholder="À quoi sert cette procédure…" /></L>

          <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 6 }}>FICHIER (PDF ou vidéo, max 50 Mo)</div>
            <input type="file" accept=".pdf,video/*,image/*" onChange={async e => { const fl = e.target.files?.[0]; if (fl) { if (fl.size > 50 * 1024 * 1024) { alert("Fichier trop volumineux (max 50 Mo). Pour une vidéo plus lourde, collez un lien ci-dessous."); return; } setFile(await fileToB64(fl)); } }} style={{ fontSize: 13 }} />
            {file && <div style={{ fontSize: 12, color: GREEN, marginTop: 4 }}>✓ {file.name}</div>}
            {!file && proc?.hasFile && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>Fichier actuel conservé si vous n'en choisissez pas un nouveau.</div>}
          </div>

          <L label="…ou lien vidéo (YouTube / Vimeo)"><input value={f.url} onChange={e => set("url", e.target.value)} style={inp} placeholder="https://youtu.be/…" /></L>
          <div style={{ fontSize: 11.5, color: "#9ca3af" }}>Conseil : pour une vidéo longue, préférez un lien (YouTube/Vimeo) plutôt qu'un fichier.</div>
        </div>
        <div style={{ padding: "14px 20px", borderTop: `1px solid ${BORDER}`, display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>Annuler</button>
          <button onClick={submit} disabled={!f.title.trim() || saving} style={{ background: !f.title.trim() ? "#e5e7eb" : GOLD, color: !f.title.trim() ? "#9ca3af" : "#fff", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>{saving ? "Enregistrement…" : "Enregistrer"}</button>
        </div>
      </div>
    </>
  );
}

const miniBtn: React.CSSProperties = { border: `1px solid ${BORDER}`, background: "#fff", color: DARK, borderRadius: 7, padding: "5px 9px", fontSize: 12, cursor: "pointer" };
const actBtn: React.CSSProperties = { border: `1px solid ${GOLD}`, background: GOLD_BG, color: GOLD, borderRadius: 8, padding: "6px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" };
const inp: React.CSSProperties = { width: "100%", minHeight: 38, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 10px", fontSize: 13, outline: "none", background: "#f9fafb", fontFamily: "inherit", boxSizing: "border-box" };
function L({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 5 }}>{label}</div>{children}</div>;
}
