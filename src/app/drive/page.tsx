"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";

const GOLD = "#B8966A"; const GOLD_BG = "#F7F0E6"; const DARK = "#1C1A17"; const BORDER = "#E6E1D9"; const RED = "#DC2626";

interface DriveItem { id: string; parentId: string | null; kind: string; name: string; mime?: string; size?: number; system?: boolean; readonly?: boolean; visibility?: string; sharedFrom?: string }
interface SearchHit { id: string; kind: string; name: string; mime?: string | null; size?: number | null; folder: string; sharedFrom?: string | null }

const VIS_LABEL: Record<string, string> = { gestionnaire: "Gestionnaires", direction: "Direction", tous: "Toute l'agence" };
function VisBadge({ v }: { v?: string }) {
  if (!v || v === "confidentiel") return null;
  return <span style={{ fontSize: 9.5, fontWeight: 700, color: "#2563eb", background: "#E8EEFB", borderRadius: 20, padding: "1px 7px", whiteSpace: "nowrap" }}>{VIS_LABEL[v] ?? v}</span>;
}
function fileIcon(mime?: string | null) {
  if (!mime) return "📄";
  if (mime.startsWith("image/")) return "🖼";
  if (mime.includes("pdf")) return "📕";
  if (mime.includes("word") || mime.includes("document")) return "📘";
  if (mime.includes("sheet") || mime.includes("excel") || mime.includes("csv")) return "📗";
  if (mime.includes("zip") || mime.includes("compress")) return "🗜";
  if (mime.startsWith("video/")) return "🎬";
  if (mime.startsWith("audio/")) return "🎵";
  return "📄";
}
function fmtSize(n?: number | null) {
  if (n == null) return "";
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} Ko`;
  return `${(n / 1024 / 1024).toFixed(1)} Mo`;
}
function fileToB64(file: File): Promise<{ name: string; mime: string; size: number; data: string }> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => { const s = String(r.result); resolve({ name: file.name, mime: file.type, size: file.size, data: s.slice(s.indexOf(",") + 1) }); };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export default function DrivePage() {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F3F1EC" }}>
      <Sidebar active="drive" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100vh", overflow: "hidden" }}>
        <Topbar title="Drive" />
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "20px 24px" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <DriveExplorer />
          </div>
        </div>
      </div>
    </div>
  );
}

function DriveExplorer() {
  const [parentId, setParentId] = useState<string | null>(null);
  const [path, setPath] = useState<{ id: string; name: string }[]>([]);
  const [items, setItems] = useState<DriveItem[]>([]);
  const [shared, setShared] = useState<DriveItem[]>([]);
  const [hereReadonly, setHereReadonly] = useState(false);
  const [canManageCommon, setCanManageCommon] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [showCommon, setShowCommon] = useState(false);
  // Recherche
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<SearchHit[] | null>(null);
  const [aiAnswer, setAiAnswer] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

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
    const r = await fetch(`/api/me/drive/${it.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim() }) });
    if (!r.ok) { const d = await r.json().catch(() => ({})); alert(d.error || "Impossible de renommer."); }
    await load(parentId, hereReadonly);
  }
  async function remove(it: DriveItem) {
    if (!confirm(it.kind === "folder" ? `Supprimer le dossier « ${it.name} » et tout son contenu ?` : `Supprimer « ${it.name} » ?`)) return;
    const r = await fetch(`/api/me/drive/${it.id}`, { method: "DELETE" });
    if (!r.ok) { const d = await r.json().catch(() => ({})); alert(d.error || "Impossible de supprimer."); }
    await load(parentId, hereReadonly);
  }
  // Déplace un élément dans un dossier (drag & drop). targetId null = remonter à la racine.
  async function move(itemId: string, targetId: string | null) {
    if (itemId === targetId) return;
    const r = await fetch(`/api/me/drive/${itemId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ parentId: targetId }) });
    if (!r.ok) { const d = await r.json().catch(() => ({})); alert(d.error || "Déplacement impossible."); }
    await load(parentId, hereReadonly);
  }

  async function runSearch(ai: boolean) {
    if (!query.trim() || searching) return;
    setSearching(true); setAiAnswer("");
    try {
      const r = await fetch("/api/me/drive/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ q: query.trim(), ai }) });
      const d = await r.json().catch(() => ({ results: [] }));
      setResults(d.results ?? []); setAiAnswer(d.answer ?? "");
    } catch { setResults([]); }
    finally { setSearching(false); }
  }
  function clearSearch() { setResults(null); setQuery(""); setAiAnswer(""); }
  function openHit(h: SearchHit) { if (h.kind === "folder") { clearSearch(); load(h.id); } else window.open(`/api/me/drive/${h.id}`, "_blank"); }

  const crumb: React.CSSProperties = { background: "none", border: "none", cursor: "pointer", color: GOLD, fontSize: 13, padding: "2px 4px", borderRadius: 6 };
  const miniBtn: React.CSSProperties = { border: `1px solid ${BORDER}`, background: "#fff", borderRadius: 7, padding: "4px 8px", fontSize: 12, cursor: "pointer", color: DARK };

  return (
    <div>
      {/* Barre d'outils */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
        <div style={{ flex: 1, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", minWidth: 200 }}>
          <button onClick={() => load(null)}
            onDragOver={e => { if (dragId) { e.preventDefault(); setDropTarget("root"); } }}
            onDragLeave={() => setDropTarget(t => t === "root" ? null : t)}
            onDrop={e => { e.preventDefault(); if (dragId) move(dragId, null); setDragId(null); setDropTarget(null); }}
            style={{ ...crumb, fontWeight: 600, background: dropTarget === "root" ? GOLD_BG : "none", border: dropTarget === "root" ? `1px dashed ${GOLD}` : "1px solid transparent" }}>🏠 Drive</button>
          {path.map(p => (
            <span key={p.id} style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ color: "#d1d5db" }}>/</span>
              <button onClick={() => load(p.id)} style={crumb}>{p.name}</button>
            </span>
          ))}
        </div>
        {canManageCommon && <button onClick={() => setShowCommon(true)} style={{ ...miniBtn, color: DARK }}>🛡 Dossiers imposés</button>}
        <button onClick={newFolder} disabled={busy || !writable} title={writable ? "" : "Dossier en lecture seule"} style={{ background: "#fff", color: writable ? GOLD : "#cbd5e1", border: `1px solid ${writable ? GOLD : BORDER}`, borderRadius: 8, padding: "8px 14px", fontSize: 13, cursor: writable ? "pointer" : "not-allowed" }}>📁 Nouveau dossier</button>
        <button onClick={() => fileRef.current?.click()} disabled={!writable} style={{ background: writable ? GOLD : "#e5e7eb", color: "#fff", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 500, border: "none", cursor: writable ? "pointer" : "not-allowed" }}>⬆ Téléverser</button>
        <input ref={fileRef} type="file" multiple style={{ display: "none" }} onChange={e => { upload(e.target.files); e.target.value = ""; }} />
      </div>

      {/* Recherche */}
      <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
          <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: "#9ca3af", fontSize: 14 }}>🔎</span>
          <input value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") runSearch(false); if (e.key === "Escape") clearSearch(); }}
            placeholder="Rechercher un document, ou décrivez ce que vous cherchez…"
            style={{ width: "100%", height: 40, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "0 34px 0 32px", fontSize: 13, outline: "none", boxSizing: "border-box", background: "#fff" }} />
          {results !== null && <button onClick={clearSearch} title="Fermer" style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", cursor: "pointer", color: "#9ca3af", fontSize: 15 }}>✕</button>}
        </div>
        <button onClick={() => runSearch(false)} disabled={!query.trim() || searching} style={{ ...miniBtn, padding: "9px 14px" }}>Rechercher</button>
        <button onClick={() => runSearch(true)} disabled={!query.trim() || searching} title="Auguste cherche pour vous"
          style={{ background: query.trim() ? GOLD : "#e5e7eb", color: "#fff", border: "none", borderRadius: 8, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: query.trim() ? "pointer" : "not-allowed" }}>✦ Auguste cherche</button>
      </div>

      {hereReadonly && <div style={{ fontSize: 12, color: "#8a6d44", background: GOLD_BG, borderRadius: 8, padding: "7px 12px", marginBottom: 10 }}>🔒 Dossier imposé en lecture seule — seul le super administrateur peut y déposer des documents.</div>}
      {busy && <div style={{ fontSize: 12, color: GOLD, marginBottom: 8 }}>Transfert en cours…</div>}

      {/* Résultats de recherche OU arborescence */}
      {results !== null ? (
        <div>
          {searching && <div style={{ color: "#9ca3af", padding: 20, textAlign: "center" }}>Recherche en cours…</div>}
          {!searching && aiAnswer && <div style={{ background: GOLD_BG, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 14px", fontSize: 13, color: DARK, marginBottom: 12 }}>✦ {aiAnswer}</div>}
          {!searching && (
            <>
              <div style={{ fontSize: 12.5, color: "#6b7280", marginBottom: 10 }}>{results.length} résultat{results.length > 1 ? "s" : ""} pour « {query} »</div>
              {results.length === 0 ? <div style={{ color: "#9ca3af", padding: 30, textAlign: "center" }}>Aucun document trouvé.</div> : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {results.map(h => (
                    <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "10px 14px" }}>
                      <div style={{ fontSize: 24 }}>{h.kind === "folder" ? "📁" : fileIcon(h.mime)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <button onClick={() => openHit(h)} style={{ background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", fontWeight: 600, fontSize: 13.5, color: DARK, wordBreak: "break-word" }}>{h.name}</button>
                        <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 2 }}>📂 {h.folder}{h.kind === "file" && h.size != null ? ` · ${fmtSize(h.size)}` : ""}{h.sharedFrom ? ` · partagé · ${h.sharedFrom}` : ""}</div>
                      </div>
                      {h.kind === "file" && <a href={`/api/me/drive/${h.id}`} download style={{ ...miniBtn, textDecoration: "none", color: GOLD }}>⬇</a>}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      ) : loading ? <div style={{ color: "#9ca3af", padding: 40, textAlign: "center" }}>Chargement…</div>
       : (items.length === 0 && shared.length === 0) ? <div style={{ color: "#9ca3af", padding: 40, textAlign: "center" }}>Dossier vide — glissez-déposez vos fichiers ou créez un dossier.</div>
       : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(190px, 1fr))", gap: 12 }}>
          {items.map(it => {
            const isFolder = it.kind === "folder";
            const isDropHere = dropTarget === it.id && isFolder;
            return (
              <div key={it.id}
                draggable={!it.system}
                onDragStart={e => { setDragId(it.id); e.dataTransfer.effectAllowed = "move"; }}
                onDragEnd={() => { setDragId(null); setDropTarget(null); }}
                onDragOver={e => { if (isFolder && dragId && dragId !== it.id) { e.preventDefault(); setDropTarget(it.id); } }}
                onDragLeave={() => setDropTarget(t => t === it.id ? null : t)}
                onDrop={e => { if (isFolder && dragId) { e.preventDefault(); move(dragId, it.id); } setDragId(null); setDropTarget(null); }}
                style={{ background: isDropHere ? GOLD_BG : "#fff", border: `1px ${isDropHere ? "dashed" : "solid"} ${isDropHere ? GOLD : BORDER}`, borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 8, opacity: dragId === it.id ? 0.45 : 1, cursor: it.system ? "default" : "grab" }}>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <div style={{ fontSize: 26 }}>{isFolder ? (it.system ? "🗂" : "📁") : fileIcon(it.mime)}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {isFolder
                      ? <button onClick={() => load(it.id, it.readonly)} style={{ background: "none", border: "none", padding: 0, textAlign: "left", cursor: "pointer", fontWeight: 600, fontSize: 13, color: DARK, wordBreak: "break-word" }}>{it.name}</button>
                      : <a href={`/api/me/drive/${it.id}`} target="_blank" rel="noreferrer" style={{ fontWeight: 600, fontSize: 13, color: DARK, textDecoration: "none", wordBreak: "break-word" }}>{it.name}</a>}
                    <div style={{ display: "flex", gap: 5, alignItems: "center", marginTop: 3, flexWrap: "wrap" }}>
                      {it.kind === "file" && it.size != null && <span style={{ fontSize: 11, color: "#9ca3af" }}>{fmtSize(it.size)}</span>}
                      {isFolder && <VisBadge v={it.visibility} />}
                      {it.system && <span style={{ fontSize: 9.5, color: "#9ca3af" }} title="Dossier imposé par l'agence">🔒 imposé</span>}
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                  {it.kind === "file" && <a href={`/api/me/drive/${it.id}`} download style={{ ...miniBtn, textDecoration: "none", color: GOLD }}>⬇</a>}
                  {!it.system && <button onClick={() => rename(it)} style={miniBtn} title="Renommer">✏</button>}
                  {!it.system && <button onClick={() => remove(it)} style={{ ...miniBtn, color: RED, borderColor: "#fecaca" }} title="Supprimer">✕</button>}
                </div>
              </div>
            );
          })}
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

// Gestion des dossiers imposés (super admin) — noms non modifiables par les agents.
function CommonFoldersModal({ onClose }: { onClose: () => void }) {
  interface Tpl { id: string; name: string; visibility: string; readonly: boolean; parentKey?: string | null }
  interface Parent { key: string; name: string }
  const VIS = [
    { id: "confidentiel", label: "Confidentiel (chacun le sien)" },
    { id: "gestionnaire", label: "Gestionnaires" },
    { id: "direction", label: "Direction" },
    { id: "tous", label: "Toute l'agence" },
  ];
  const [list, setList] = useState<Tpl[]>([]);
  const [defaults, setDefaults] = useState<Parent[]>([]);
  const [name, setName] = useState("");
  const [vis, setVis] = useState("confidentiel");
  const [ro, setRo] = useState(false);
  const [parent, setParent] = useState("");
  const [loading, setLoading] = useState(true);
  const reload = () => fetch("/api/agency/drive/templates").then(r => r.ok ? r.json() : { templates: [] }).then(d => { setList(d.templates ?? []); setDefaults(d.defaults ?? []); }).finally(() => setLoading(false));
  useEffect(() => { reload(); }, []);

  // Parents possibles : dossiers par défaut + modèles existants.
  const parentOptions: Parent[] = [...defaults, ...list.map(t => ({ key: `tpl:${t.id}`, name: t.name }))];
  const parentName = (key?: string | null) => key ? (parentOptions.find(p => p.key === key)?.name ?? "—") : null;

  async function add() {
    if (!name.trim()) return;
    await fetch("/api/agency/drive/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), visibility: vis, readonly: ro, parentKey: parent || null }) });
    setName(""); setVis("confidentiel"); setRo(false); setParent(""); reload();
  }
  async function rename(t: Tpl) {
    const n = prompt("Nouveau nom du dossier imposé :", t.name);
    if (!n?.trim() || n === t.name) return;
    await fetch("/api/agency/drive/templates", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: t.id, name: n.trim() }) });
    reload();
  }
  async function setVisibility(t: Tpl, v: string) {
    await fetch("/api/agency/drive/templates", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: t.id, visibility: v }) });
    reload();
  }
  async function del(t: Tpl) {
    if (!confirm(`Supprimer le dossier imposé « ${t.name} » de TOUS les drives (avec son contenu) ?`)) return;
    await fetch("/api/agency/drive/templates", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: t.id }) });
    reload();
  }

  const input: React.CSSProperties = { height: 36, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "0 10px", fontSize: 13, outline: "none", background: "#fff", boxSizing: "border-box" };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: 560, maxWidth: "96vw", maxHeight: "88vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: DARK }}>🛡 Dossiers imposés</div>
            <div style={{ fontSize: 12, color: "#6b7280" }}>Poussés sur le Drive de tous les agents. Nom non modifiable par les utilisateurs.</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af" }}>×</button>
        </div>
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", background: "#FAFAF8", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 12 }}>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Nom du dossier imposé" style={{ ...input, flex: 1, minWidth: 160 }} />
            <select value={parent} onChange={e => setParent(e.target.value)} title="Dossier parent" style={input}>
              <option value="">📁 Racine (aucun parent)</option>
              {parentOptions.map(p => <option key={p.key} value={p.key}>↳ dans « {p.name} »</option>)}
            </select>
            <select value={vis} onChange={e => setVis(e.target.value)} style={input}>{VIS.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}</select>
            <label style={{ fontSize: 12, color: DARK, display: "flex", alignItems: "center", gap: 5 }}><input type="checkbox" checked={ro} onChange={e => setRo(e.target.checked)} /> Lecture seule</label>
            <button onClick={add} disabled={!name.trim()} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Ajouter</button>
          </div>
          {loading ? <div style={{ color: "#9ca3af", textAlign: "center", padding: 20 }}>Chargement…</div>
           : list.length === 0 ? <div style={{ color: "#9ca3af", textAlign: "center", padding: 20 }}>Aucun dossier imposé personnalisé. (Les 10 dossiers par défaut sont toujours présents.)</div>
           : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {list.map(t => (
                <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 8, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "8px 12px" }}>
                  <span style={{ fontSize: 20 }}>🗂</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: DARK }}>{t.name}{t.readonly && <span style={{ fontSize: 10, color: "#9ca3af", marginLeft: 6 }}>(lecture seule)</span>}</div>
                    {t.parentKey && <div style={{ fontSize: 10.5, color: GOLD }}>↳ sous-dossier de « {parentName(t.parentKey)} »</div>}
                  </div>
                  <select value={t.visibility} onChange={e => setVisibility(t, e.target.value)} style={{ ...input, height: 30, fontSize: 12 }}>{VIS.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}</select>
                  <button onClick={() => rename(t)} style={{ border: `1px solid ${BORDER}`, background: "#fff", borderRadius: 7, padding: "5px 9px", fontSize: 12, cursor: "pointer" }}>✏</button>
                  <button onClick={() => del(t)} style={{ border: "1px solid #fecaca", background: "#fff", color: RED, borderRadius: 7, padding: "5px 9px", fontSize: 12, cursor: "pointer" }}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
