"use client";
import { useEffect, useState, useRef } from "react";

const GOLD = "#B8966A"; const BORDER = "#E6E1D9";

const CATEGORIES: { id: string; label: string; color: string }[] = [
  { id: "general",       label: "Général",        color: "#6B7280" },
  { id: "juridique",     label: "Juridique",      color: "#7C3AED" },
  { id: "comptabilite",  label: "Comptabilité",   color: "#059669" },
  { id: "procedure",     label: "Procédures",     color: "#2563EB" },
  { id: "baux",          label: "Baux & Contrats",color: "#B8966A" },
  { id: "autre",         label: "Autre",          color: "#9CA3AF" },
];

interface Doc { id: string; title: string; category: string; fileName: string | null; fileSize: number | null; active: boolean; createdAt: string; content: string }

const inp: React.CSSProperties = { height: 34, border: `1px solid ${BORDER}`, borderRadius: 7, padding: "0 10px", fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box", background: "#fff" };
const catInfo = (id: string) => CATEGORIES.find(c => c.id === id) ?? CATEGORIES[0];
function fmtSize(b: number | null) { if (!b) return ""; return b > 1024*1024 ? `${(b/1024/1024).toFixed(1)} Mo` : `${Math.round(b/1024)} Ko`; }

export default function KnowledgeAdmin() {
  const [docs, setDocs]           = useState<Doc[]>([]);
  const [loading, setLoading]     = useState(true);
  const [filterCat, setFilterCat] = useState("all");
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState<Doc | null>(null);
  const [preview, setPreview]     = useState<Doc | null>(null);
  const [saving, setSaving]       = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({ title: "", category: "general", content: "", fileName: "", fileSize: 0 });

  useEffect(() => { fetch("/api/knowledge").then(r => r.json()).then(setDocs).finally(() => setLoading(false)); }, []);

  function openNew() { setForm({ title: "", category: "general", content: "", fileName: "", fileSize: 0 }); setEditing(null); setShowForm(true); }
  function openEdit(d: Doc) { setForm({ title: d.title, category: d.category, content: d.content, fileName: d.fileName ?? "", fileSize: d.fileSize ?? 0 }); setEditing(d); setShowForm(true); }

  // Lecture fichier texte ou PDF (extraction texte brut)
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result as string;
      setForm(p => ({ ...p, content: text, fileName: file.name, fileSize: file.size, title: p.title || file.name.replace(/\.[^/.]+$/, "") }));
    };
    // Pour les PDF on lit en tant que texte (les PDF textuels sont lisibles ainsi, sinon l'utilisateur colle le texte)
    reader.readAsText(file, "utf-8");
  }

  async function save() {
    if (!form.title || !form.content) return;
    setSaving(true);
    try {
      if (editing) {
        const res = await fetch("/api/knowledge", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editing.id, ...form }) });
        const updated = await res.json();
        setDocs(p => p.map(d => d.id === editing.id ? updated : d));
      } else {
        const res = await fetch("/api/knowledge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
        const created = await res.json();
        setDocs(p => [created, ...p]);
      }
      setShowForm(false);
    } finally { setSaving(false); }
  }

  async function toggleActive(d: Doc) {
    const res = await fetch("/api/knowledge", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: d.id, title: d.title, category: d.category, content: d.content, active: !d.active }) });
    const updated = await res.json();
    setDocs(p => p.map(x => x.id === d.id ? updated : x));
  }

  async function remove(id: string) {
    if (!confirm("Supprimer ce document ?")) return;
    await fetch("/api/knowledge", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setDocs(p => p.filter(d => d.id !== id));
  }

  const filtered = filterCat === "all" ? docs : docs.filter(d => d.category === filterCat);
  const activeCount = docs.filter(d => d.active).length;

  return (
    <div style={{ maxWidth: 900 }}>
      {/* En-tête */}
      <div style={{ background: "linear-gradient(135deg, #1C1A17 0%, #2D2A24 100%)", borderRadius: 14, padding: "20px 24px", marginBottom: 24, color: "#fff", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>✦ Base de connaissance Auguste</div>
          <div style={{ fontSize: 12, opacity: 0.65, marginTop: 4 }}>
            {activeCount} document{activeCount > 1 ? "s" : ""} actif{activeCount > 1 ? "s" : ""} · Auguste les consulte automatiquement dans ses réponses
          </div>
        </div>
        <button onClick={openNew} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
          + Ajouter un document
        </button>
      </div>

      {/* Filtre catégorie */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        <Chip label="Tous" active={filterCat === "all"} color={GOLD} onClick={() => setFilterCat("all")} count={docs.length} />
        {CATEGORIES.map(c => (
          <Chip key={c.id} label={c.label} active={filterCat === c.id} color={c.color} onClick={() => setFilterCat(c.id)} count={docs.filter(d => d.category === c.id).length} />
        ))}
      </div>

      {/* Liste */}
      {loading ? <div style={{ textAlign: "center", color: "#9ca3af", padding: 40 }}>Chargement…</div> : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.length === 0 && <div style={{ background: "#fff", borderRadius: 10, border: `1px solid ${BORDER}`, padding: "32px", textAlign: "center", color: "#9ca3af", fontSize: 13 }}>Aucun document dans cette catégorie</div>}
          {filtered.map(d => {
            const cat = catInfo(d.category);
            return (
              <div key={d.id} style={{ background: "#fff", borderRadius: 10, border: `1px solid ${d.active ? BORDER : "#f3f4f6"}`, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, opacity: d.active ? 1 : 0.55 }}>
                {/* Icône catégorie */}
                <div style={{ width: 40, height: 40, borderRadius: 10, background: cat.color + "15", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
                  {{ general: "📋", juridique: "⚖", comptabilite: "📊", procedure: "📌", baux: "📄", autre: "📁" }[d.category] ?? "📋"}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{d.title}</span>
                    <span style={{ background: cat.color + "18", color: cat.color, borderRadius: 5, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>{cat.label}</span>
                    {!d.active && <span style={{ background: "#f3f4f6", color: "#9ca3af", borderRadius: 5, padding: "1px 7px", fontSize: 10, fontWeight: 600 }}>Désactivé</span>}
                  </div>
                  <div style={{ fontSize: 11, color: "#9ca3af" }}>
                    {d.fileName && <span style={{ marginRight: 10 }}>📎 {d.fileName} {d.fileSize ? `(${fmtSize(d.fileSize)})` : ""}</span>}
                    <span>{d.content.length.toLocaleString("fr-FR")} caractères</span>
                    <span style={{ margin: "0 8px" }}>·</span>
                    <span>{new Date(d.createdAt).toLocaleDateString("fr-FR")}</span>
                  </div>
                </div>
                {/* Extrait */}
                <div style={{ fontSize: 11, color: "#6b7280", maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 0 }}>
                  {d.content.slice(0, 120).replace(/\s+/g, " ")}…
                </div>
                {/* Actions */}
                <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                  <IconBtn title="Aperçu" onClick={() => setPreview(d)}>👁</IconBtn>
                  <IconBtn title="Modifier" onClick={() => openEdit(d)}>✏</IconBtn>
                  <IconBtn title={d.active ? "Désactiver" : "Activer"} onClick={() => toggleActive(d)}>{d.active ? "⏸" : "▶"}</IconBtn>
                  <IconBtn title="Supprimer" onClick={() => remove(d.id)} danger>🗑</IconBtn>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal ajout/édition */}
      {showForm && (
        <>
          <div onClick={() => setShowForm(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 50 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 640, maxWidth: "96vw", background: "#fff", borderRadius: 16, zIndex: 51, boxShadow: "0 24px 80px rgba(0,0,0,0.2)", display: "flex", flexDirection: "column", maxHeight: "90vh" }}>
            {/* Header */}
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <span style={{ fontSize: 15, fontWeight: 700, color: "#1C1A17" }}>{editing ? "Modifier" : "Ajouter"} un document</span>
              <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#9ca3af" }}>×</button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
              {/* Titre */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Titre *</label>
                <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="Ex : Loi ALUR – délais préavis" style={inp} />
              </div>

              {/* Catégorie */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Catégorie</label>
                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} style={{ ...inp, cursor: "pointer" }}>
                  {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </div>

              {/* Upload fichier */}
              <div>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Importer un fichier (.txt, .pdf texte, .md)</label>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input ref={fileRef} type="file" accept=".txt,.md,.pdf,.csv" onChange={handleFile} style={{ display: "none" }} />
                  <button onClick={() => fileRef.current?.click()} style={{ background: "#f9fafb", border: `1px dashed ${BORDER}`, borderRadius: 7, padding: "7px 14px", fontSize: 12, cursor: "pointer", color: "#6b7280" }}>
                    📎 Choisir un fichier
                  </button>
                  {form.fileName && <span style={{ fontSize: 12, color: GOLD, fontWeight: 500 }}>✓ {form.fileName} {form.fileSize ? `(${fmtSize(form.fileSize)})` : ""}</span>}
                </div>
                <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>Pour les PDF scannés (images), copiez-collez le texte directement ci-dessous.</div>
              </div>

              {/* Contenu texte */}
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.05em" }}>Contenu *</label>
                <textarea
                  value={form.content}
                  onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
                  placeholder="Collez ici le texte du document, des articles de loi, des procédures internes, des modèles de réponse…"
                  style={{ width: "100%", minHeight: 220, border: `1px solid ${BORDER}`, borderRadius: 7, padding: "10px 12px", fontSize: 12, outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", lineHeight: 1.6 }}
                />
                <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 3 }}>{form.content.length.toLocaleString("fr-FR")} caractères</div>
              </div>

              {/* Conseils */}
              <div style={{ background: "#F7F0E6", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 14px", fontSize: 11, color: "#6b7280", lineHeight: 1.6 }}>
                <strong style={{ color: GOLD }}>✦ Conseils :</strong> Auguste utilisera ce contenu pour enrichir ses réponses juridiques, comptables ou procédurales.
                Plus le texte est structuré (titres, articles numérotés), plus Auguste sera précis.
                Exemples : loi du 6 juillet 1989, grille IRL, modèle de lettre de relance, procédure interne GLI…
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: "14px 20px", borderTop: `1px solid ${BORDER}`, display: "flex", gap: 8, justifyContent: "flex-end", flexShrink: 0 }}>
              <button onClick={() => setShowForm(false)} style={{ background: "#f9fafb", border: `1px solid ${BORDER}`, borderRadius: 7, padding: "8px 16px", fontSize: 13, cursor: "pointer", color: "#6b7280" }}>Annuler</button>
              <button onClick={save} disabled={saving || !form.title || !form.content}
                style={{ background: saving || !form.title || !form.content ? "#e5e7eb" : GOLD, color: "#fff", border: "none", borderRadius: 7, padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                {saving ? "Enregistrement…" : editing ? "Mettre à jour" : "Ajouter"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Modal aperçu */}
      {preview && (
        <>
          <div onClick={() => setPreview(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 50 }} />
          <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 680, maxWidth: "96vw", background: "#fff", borderRadius: 16, zIndex: 51, boxShadow: "0 24px 80px rgba(0,0,0,0.2)", maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#1C1A17" }}>{preview.title}</div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{catInfo(preview.category).label} · {preview.content.length.toLocaleString("fr-FR")} caractères</div>
              </div>
              <button onClick={() => setPreview(null)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#9ca3af" }}>×</button>
            </div>
            <pre style={{ flex: 1, overflowY: "auto", margin: 0, padding: "16px 20px", fontSize: 12, lineHeight: 1.7, color: "#374151", fontFamily: "inherit", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {preview.content}
            </pre>
          </div>
        </>
      )}
    </div>
  );
}

function Chip({ label, active, color, onClick, count }: { label: string; active: boolean; color: string; onClick: () => void; count: number }) {
  return (
    <button onClick={onClick} style={{ background: active ? color : "#fff", color: active ? "#fff" : "#6b7280", border: `1px solid ${active ? color : BORDER}`, borderRadius: 20, padding: "5px 12px", fontSize: 12, cursor: "pointer", fontWeight: active ? 600 : 400, display: "flex", alignItems: "center", gap: 5 }}>
      {label} <span style={{ background: active ? "rgba(255,255,255,0.25)" : "#f3f4f6", borderRadius: 10, padding: "0 5px", fontSize: 10, fontWeight: 700 }}>{count}</span>
    </button>
  );
}

function IconBtn({ children, title, onClick, danger }: { children: React.ReactNode; title: string; onClick: () => void; danger?: boolean }) {
  return (
    <button title={title} onClick={onClick} style={{ width: 30, height: 30, border: `1px solid ${danger ? "#fecaca" : BORDER}`, borderRadius: 6, background: "#fff", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", justifyContent: "center", color: danger ? "#ef4444" : "#6b7280" }}>
      {children}
    </button>
  );
}
