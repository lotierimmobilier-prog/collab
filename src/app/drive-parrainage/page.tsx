"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Sidebar from "@/components/Sidebar";

const GOLD = "#B8966A"; const DARK = "#1C1A17"; const BORDER = "#E6E1D9"; const GOLD_BG = "#F7F0E6";
const RED = "#DC2626"; const BLUE = "#2563EB";

interface Doc { id: string; ownerId: string; ownerName?: string; fileName: string; mime: string | null; size: number | null; note: string | null; createdAt: string }

function human(n?: number | null) { if (!n) return ""; if (n < 1024) return `${n} o`; if (n < 1048576) return `${Math.round(n / 1024)} Ko`; return `${(n / 1048576).toFixed(1)} Mo`; }
function icon(mime?: string | null, name?: string) {
  const m = (mime || "").toLowerCase(); const ext = (name || "").split(".").pop()?.toLowerCase();
  if (m.includes("pdf") || ext === "pdf") return "📕";
  if (m.startsWith("image/")) return "🖼";
  if (m.includes("word") || ["doc", "docx"].includes(ext || "")) return "📘";
  if (m.includes("sheet") || ["xls", "xlsx", "csv"].includes(ext || "")) return "📗";
  return "📄";
}

export default function DriveParrainagePage() {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [me, setMe] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const [d, s] = await Promise.all([
        fetch("/api/parrainage/docs").then(r => r.json()),
        fetch("/api/auth/session").then(r => r.json()).catch(() => ({})),
      ]);
      setDocs(d.docs ?? []);
      setMe(s?.user?.id ?? "");
    } catch { /* ignore */ }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function onFiles(files: FileList | null) {
    if (!files || !files.length) return;
    setUploading(true);
    for (const file of Array.from(files)) {
      if (file.size > 20 * 1024 * 1024) { alert(`« ${file.name} » dépasse 20 Mo.`); continue; }
      const data = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] ?? ""); r.onerror = rej; r.readAsDataURL(file); });
      await fetch("/api/parrainage/docs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fileName: file.name, mime: file.type, size: file.size, data }) }).catch(() => {});
    }
    setUploading(false); if (fileRef.current) fileRef.current.value = ""; load();
  }
  async function del(id: string) { if (!confirm("Supprimer ce document ?")) return; await fetch(`/api/parrainage/docs?id=${id}`, { method: "DELETE" }); load(); }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#FAF8F5" }}>
      <Sidebar active="drive" />
      <main style={{ flex: 1, padding: "28px 32px", maxWidth: 900, margin: "0 auto", width: "100%" }}>
        <a href="/drive" style={{ fontSize: 12.5, color: GOLD, textDecoration: "none", fontWeight: 600 }}>← Retour au Drive</a>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: DARK, margin: "6px 0 0" }}>🤝 Drive Parrain/Filleul</h1>
        <p style={{ color: "#6b7280", fontSize: 13, marginTop: 4, marginBottom: 18 }}>
          Espace partagé avec toute votre lignée de parrainage — vos parrains et vos filleuls (et les filleuls de vos filleuls) voient ces documents.
        </p>

        {/* Dépôt */}
        <div
          onDragOver={e => { e.preventDefault(); }}
          onDrop={e => { e.preventDefault(); onFiles(e.dataTransfer.files); }}
          style={{ background: "#fff", border: `1.5px dashed ${GOLD}`, borderRadius: 14, padding: 22, textAlign: "center", marginBottom: 18 }}
        >
          <input ref={fileRef} type="file" multiple onChange={e => onFiles(e.target.files)} style={{ display: "none" }} />
          <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 10 }}>Glissez vos fichiers ici, ou</div>
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 9, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            {uploading ? "Envoi…" : "+ Ajouter des documents"}
          </button>
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 8 }}>20 Mo max par fichier · partagé avec toute la lignée</div>
        </div>

        {loading ? (
          <p style={{ color: "#9ca3af", fontSize: 13 }}>Chargement…</p>
        ) : docs.length === 0 ? (
          <p style={{ color: "#9ca3af", fontSize: 13 }}>Aucun document pour le moment. Déposez le premier ci-dessus.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {docs.map(d => (
              <div key={d.id} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "12px 14px", display: "flex", alignItems: "center", gap: 12, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                <span style={{ fontSize: 22 }}>{icon(d.mime, d.fileName)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <a href={`/api/parrainage/docs/${d.id}`} target="_blank" rel="noreferrer" style={{ fontSize: 13.5, fontWeight: 600, color: DARK, textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }}>{d.fileName}</a>
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>
                    {d.ownerName ? `Déposé par ${d.ownerName}` : ""}{d.size ? ` · ${human(d.size)}` : ""} · {new Date(d.createdAt).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}
                  </div>
                </div>
                <a href={`/api/parrainage/docs/${d.id}`} target="_blank" rel="noreferrer" title="Ouvrir / télécharger" style={{ fontSize: 13, color: BLUE, textDecoration: "none", fontWeight: 600 }}>⬇</a>
                {d.ownerId === me && <button onClick={() => del(d.id)} title="Supprimer" style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "4px 8px", fontSize: 12, color: RED, cursor: "pointer" }}>🗑</button>}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
