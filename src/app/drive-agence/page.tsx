"use client";
import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Sidebar from "@/components/Sidebar";

const GOLD = "#B8966A"; const BORDER = "#E6E1D9"; const DARK = "#1C1A17"; const RED = "#DC2626";

interface DriveItem { id: string; parentId: string | null; kind: string; name: string; mime?: string; size?: number }

function fileToB64(file: File): Promise<{ name: string; mime: string; size: number; data: string }> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res({ name: file.name, mime: file.type || "application/octet-stream", size: file.size, data: String(r.result).split(",")[1] || "" });
    r.onerror = rej;
    r.readAsDataURL(file);
  });
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

export default function DriveAgencePage() {
  const { data: session } = useSession();
  const role = session?.user?.roleId;
  const allowed = role === "admin" || role === "direction" || role === "dirigeant";

  return (
    <div style={{ display: "flex", height: "100vh", background: "#f9fafb", fontFamily: "'Inter', sans-serif" }}>
      <Sidebar active="drive-agence" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ background: "#fff", borderBottom: `1px solid ${BORDER}`, padding: "14px 24px" }}>
          <h1 style={{ fontSize: 16, fontWeight: 700, color: DARK, margin: 0 }}>🗄 Drive d'agence</h1>
          <p style={{ fontSize: 12, color: "#6b7280", margin: "2px 0 0" }}>Documents partagés de l'agence — décomptes d'heures, modèles, archives. Réservé à la direction.</p>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          {!allowed
            ? <div style={{ color: "#9ca3af", fontSize: 14, textAlign: "center", padding: 60 }}>Réservé aux utilisateurs de la direction.</div>
            : <Drive />}
        </div>
      </div>
    </div>
  );
}

function Drive() {
  const [parentId, setParentId] = useState<string | null>(null);
  const [path, setPath] = useState<{ id: string; name: string }[]>([]);
  const [items, setItems] = useState<DriveItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (pid: string | null) => {
    setLoading(true);
    const r = await fetch(`/api/agency/drive${pid ? `?parentId=${pid}` : ""}`);
    if (r.ok) { const d = await r.json(); setItems(d.items); setPath(d.path); setParentId(d.parentId); }
    setLoading(false);
  }, []);
  useEffect(() => { load(null); }, [load]);

  async function newFolder() {
    const name = prompt("Nom du dossier :");
    if (!name?.trim()) return;
    setBusy(true);
    await fetch("/api/agency/drive", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "folder", name: name.trim(), parentId }) });
    setBusy(false); await load(parentId);
  }
  async function upload(fl: FileList | null) {
    if (!fl) return;
    setBusy(true);
    for (const file of Array.from(fl)) {
      if (file.size > 20 * 1024 * 1024) { alert(`${file.name} : trop volumineux (max 20 Mo).`); continue; }
      const b = await fileToB64(file);
      await fetch("/api/agency/drive", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "file", name: b.name, mime: b.mime, size: b.size, data: b.data, parentId }) });
    }
    setBusy(false); await load(parentId);
  }
  async function rename(it: DriveItem) {
    const name = prompt("Renommer :", it.name);
    if (!name?.trim() || name === it.name) return;
    await fetch(`/api/agency/drive/${it.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim() }) });
    await load(parentId);
  }
  async function remove(it: DriveItem) {
    if (!confirm(it.kind === "folder" ? `Supprimer le dossier « ${it.name} » et tout son contenu ?` : `Supprimer « ${it.name} » ?`)) return;
    await fetch(`/api/agency/drive/${it.id}`, { method: "DELETE" });
    await load(parentId);
  }

  return (
    <div style={{ maxWidth: 980 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ flex: 1, fontSize: 13, color: "#6b7280", display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={() => load(null)} style={crumb}>🏠 Racine</button>
          {path.map(p => <span key={p.id} style={{ display: "flex", gap: 6, alignItems: "center" }}><span style={{ color: "#d1d5db" }}>/</span><button onClick={() => load(p.id)} style={crumb}>{p.name}</button></span>)}
        </div>
        <button onClick={newFolder} disabled={busy} style={{ background: "#fff", color: GOLD, border: `1px solid ${GOLD}`, borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: "pointer" }}>📁 Nouveau dossier</button>
        <label style={{ background: GOLD, color: "#fff", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
          ⬆ Téléverser
          <input type="file" multiple style={{ display: "none" }} onChange={e => { upload(e.target.files); e.target.value = ""; }} />
        </label>
      </div>

      {busy && <div style={{ fontSize: 12, color: GOLD, marginBottom: 8 }}>Transfert en cours…</div>}
      {loading ? <div style={{ color: "#9ca3af", padding: 40, textAlign: "center" }}>Chargement…</div>
       : items.length === 0 ? <div style={{ color: "#9ca3af", padding: 40, textAlign: "center" }}>Dossier vide. Créez un dossier ou téléversez des fichiers.</div>
       : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 }}>
          {items.map(it => (
            <div key={it.id} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <div style={{ fontSize: 26 }}>{it.kind === "folder" ? "📁" : fileIcon(it.mime)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {it.kind === "folder"
                    ? <button onClick={() => load(it.id)} style={{ background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", fontWeight: 600, fontSize: 13, color: DARK, wordBreak: "break-word" }}>{it.name}</button>
                    : <a href={`/api/agency/drive/${it.id}`} target="_blank" rel="noreferrer" style={{ fontWeight: 600, fontSize: 13, color: DARK, textDecoration: "none", wordBreak: "break-word" }}>{it.name}</a>}
                  {it.kind === "file" && it.size != null && <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{fmtSize(it.size)}</div>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                {it.kind === "file" && <a href={`/api/agency/drive/${it.id}`} download style={{ ...miniBtn, textDecoration: "none", color: GOLD }}>⬇</a>}
                <button onClick={() => rename(it)} style={miniBtn}>✏</button>
                <button onClick={() => remove(it)} style={{ ...miniBtn, color: RED, borderColor: "#fecaca" }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const miniBtn: React.CSSProperties = { border: `1px solid ${BORDER}`, background: "#fff", color: DARK, borderRadius: 7, padding: "5px 9px", fontSize: 12, cursor: "pointer" };
const crumb: React.CSSProperties = { background: "none", border: "none", padding: 0, cursor: "pointer", color: GOLD, fontSize: 13, fontWeight: 500 };
