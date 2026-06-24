"use client";
import { useEffect, useRef, useState } from "react";

const GOLD = "#B8966A"; const BORDER = "#E6E1D9";

interface Props {
  value: string;           // HTML de la signature
  onChange: (html: string) => void;
  onSave: () => void;
  onCancel: () => void;
}

const COLORS = ["#111827","#374151","#6b7280","#B8966A","#2563EB","#059669","#DC2626","#7C3AED","#D97706","#fff"];

export default function SignatureEditor({ value, onChange, onSave, onCancel }: Props) {
  const [mode, setMode] = useState<"visual" | "html">("visual");
  const [htmlSource, setHtmlSource] = useState(value);
  const [showColorPicker, setShowColorPicker] = useState<"text" | "bg" | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const imgUrlRef = useRef<HTMLInputElement>(null);
  const fileRef   = useRef<HTMLInputElement>(null);

  // Sync valeur initiale
  useEffect(() => {
    if (editorRef.current && mode === "visual") {
      editorRef.current.innerHTML = value;
    }
    setHtmlSource(value);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Bascule visual → html : exporte innerHTML
  function switchToHtml() {
    if (editorRef.current) setHtmlSource(editorRef.current.innerHTML);
    setMode("html");
  }
  // Bascule html → visual : importe dans contentEditable
  function switchToVisual() {
    setMode("visual");
    setTimeout(() => {
      if (editorRef.current) editorRef.current.innerHTML = htmlSource;
    }, 0);
  }

  function handleVisualInput() {
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }

  function handleHtmlChange(v: string) {
    setHtmlSource(v);
    onChange(v);
  }

  function exec(cmd: string, val?: string) {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    handleVisualInput();
  }

  function insertHtml(html: string) {
    editorRef.current?.focus();
    document.execCommand("insertHTML", false, html);
    handleVisualInput();
  }

  // Upload image → base64
  function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const src = ev.target?.result as string;
      insertHtml(`<img src="${src}" alt="" style="max-width:200px;vertical-align:middle"/>`);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  // Insérer image par URL
  function insertImageUrl() {
    const url = imgUrlRef.current?.value.trim(); if (!url) return;
    insertHtml(`<img src="${url}" alt="" style="max-width:200px;vertical-align:middle"/>`);
    if (imgUrlRef.current) imgUrlRef.current.value = "";
  }

  // Insérer lien
  function insertLink() {
    const url = prompt("URL du lien :"); if (!url) return;
    const text = prompt("Texte du lien :") || url;
    insertHtml(`<a href="${url}" style="color:#B8966A">${text}</a>`);
  }

  const btnStyle = (active?: boolean): React.CSSProperties => ({
    width: 26, height: 26, border: `1px solid ${active ? GOLD : BORDER}`, borderRadius: 5, background: active ? GOLD + "18" : "#fff",
    cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center",
    color: active ? GOLD : "#374151", fontWeight: active ? 700 : 400, padding: 0, flexShrink: 0,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Barre mode */}
      <div style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 8 }}>
        <button onClick={() => mode === "visual" ? switchToHtml() : switchToVisual()} style={{ ...btnStyle(false), width: "auto", padding: "0 10px", fontSize: 11, fontWeight: 600, color: "#6b7280" }}>
          {mode === "visual" ? "</> HTML" : "✦ Visuel"}
        </button>
        <span style={{ fontSize: 10, color: "#9ca3af" }}>
          {mode === "visual" ? "Éditeur visuel — formatez votre signature" : "Mode HTML — éditez le code source"}
        </span>
      </div>

      {mode === "visual" && (
        <>
          {/* Toolbar */}
          <div style={{ display: "flex", gap: 3, flexWrap: "wrap", background: "#FAFAF8", border: `1px solid ${BORDER}`, borderBottom: "none", borderRadius: "8px 8px 0 0", padding: "6px 8px", alignItems: "center" }}>
            {/* Formatage */}
            <button style={btnStyle()} onClick={() => exec("bold")} title="Gras"><b>B</b></button>
            <button style={btnStyle()} onClick={() => exec("italic")} title="Italique"><i>I</i></button>
            <button style={btnStyle()} onClick={() => exec("underline")} title="Souligné"><u>U</u></button>
            <div style={{ width: 1, height: 18, background: BORDER, margin: "0 3px" }} />

            {/* Taille */}
            <select onChange={e => exec("fontSize", e.target.value)} defaultValue="3"
              style={{ height: 26, border: `1px solid ${BORDER}`, borderRadius: 5, fontSize: 11, padding: "0 4px", background: "#fff", cursor: "pointer" }}>
              {[["1","8px"],["2","10px"],["3","12px"],["4","14px"],["5","18px"],["6","24px"],["7","32px"]].map(([v,l]) =>
                <option key={v} value={v}>{l}</option>
              )}
            </select>
            <div style={{ width: 1, height: 18, background: BORDER, margin: "0 3px" }} />

            {/* Alignement */}
            <button style={btnStyle()} onClick={() => exec("justifyLeft")} title="Gauche">⬅</button>
            <button style={btnStyle()} onClick={() => exec("justifyCenter")} title="Centre">☰</button>
            <button style={btnStyle()} onClick={() => exec("justifyRight")} title="Droite">➡</button>
            <div style={{ width: 1, height: 18, background: BORDER, margin: "0 3px" }} />

            {/* Couleur texte */}
            <div style={{ position: "relative" }}>
              <button style={{ ...btnStyle(), width: 28 }} onClick={() => setShowColorPicker(p => p === "text" ? null : "text")} title="Couleur texte">
                <span style={{ fontWeight: 700, borderBottom: "2px solid #DC2626" }}>A</span>
              </button>
              {showColorPicker === "text" && (
                <ColorPicker onPick={c => { exec("foreColor", c); setShowColorPicker(null); }} onClose={() => setShowColorPicker(null)} />
              )}
            </div>

            {/* Couleur fond */}
            <div style={{ position: "relative" }}>
              <button style={{ ...btnStyle(), width: 28 }} onClick={() => setShowColorPicker(p => p === "bg" ? null : "bg")} title="Couleur fond">
                <span style={{ background: "#FDE68A", padding: "0 2px", borderRadius: 2, fontSize: 10 }}>ab</span>
              </button>
              {showColorPicker === "bg" && (
                <ColorPicker onPick={c => { exec("hiliteColor", c); setShowColorPicker(null); }} onClose={() => setShowColorPicker(null)} />
              )}
            </div>
            <div style={{ width: 1, height: 18, background: BORDER, margin: "0 3px" }} />

            {/* Image */}
            <input ref={fileRef} type="file" accept="image/*" onChange={handleImageFile} style={{ display: "none" }} />
            <button style={btnStyle()} onClick={() => fileRef.current?.click()} title="Insérer image depuis fichier">🖼</button>

            {/* Image par URL */}
            <div style={{ display: "flex", gap: 3, alignItems: "center" }}>
              <input ref={imgUrlRef} placeholder="URL image…" style={{ height: 26, width: 120, border: `1px solid ${BORDER}`, borderRadius: 5, padding: "0 6px", fontSize: 11, outline: "none" }} onKeyDown={e => e.key === "Enter" && insertImageUrl()} />
              <button style={btnStyle()} onClick={insertImageUrl} title="Insérer">↵</button>
            </div>
            <div style={{ width: 1, height: 18, background: BORDER, margin: "0 3px" }} />

            {/* Lien */}
            <button style={btnStyle()} onClick={insertLink} title="Insérer un lien">🔗</button>

            {/* Ligne horizontale */}
            <button style={btnStyle()} onClick={() => insertHtml("<hr style='border:none;border-top:1px solid #e5e7eb;margin:6px 0'/>")} title="Séparateur">—</button>

            {/* Effacer formatage */}
            <button style={{ ...btnStyle(), marginLeft: "auto" }} onClick={() => exec("removeFormat")} title="Effacer le formatage">✕</button>
          </div>

          {/* Zone éditable */}
          <div
            ref={editorRef}
            contentEditable
            suppressContentEditableWarning
            onInput={handleVisualInput}
            style={{ minHeight: 120, border: `1px solid ${BORDER}`, borderRadius: "0 0 8px 8px", padding: "10px 14px", fontSize: 13, outline: "none", lineHeight: 1.6, background: "#fff", overflowY: "auto", maxHeight: 260 }}
          />
        </>
      )}

      {mode === "html" && (
        <textarea
          value={htmlSource}
          onChange={e => handleHtmlChange(e.target.value)}
          style={{ width: "100%", minHeight: 160, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 12px", fontSize: 12, fontFamily: "monospace", outline: "none", resize: "vertical", boxSizing: "border-box", background: "#1C1A17", color: "#d4d4d8", lineHeight: 1.7 }}
        />
      )}

      {/* Aperçu HTML (mode html seulement) */}
      {mode === "html" && htmlSource && (
        <div style={{ marginTop: 8, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 14px" }}>
          <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Aperçu</div>
          <div dangerouslySetInnerHTML={{ __html: htmlSource }} />
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button onClick={onSave} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 7, padding: "7px 16px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Sauvegarder</button>
        <button onClick={onCancel} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 7, padding: "7px 14px", fontSize: 12, cursor: "pointer", color: "#6b7280" }}>Annuler</button>
        <button onClick={() => { onChange(""); if (editorRef.current) editorRef.current.innerHTML = ""; setHtmlSource(""); }} style={{ background: "none", border: `1px solid #fecaca`, borderRadius: 7, padding: "7px 10px", fontSize: 11, cursor: "pointer", color: "#ef4444", marginLeft: "auto" }}>Effacer</button>
      </div>
    </div>
  );
}

function ColorPicker({ onPick, onClose }: { onPick: (c: string) => void; onClose: () => void }) {
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 100 }} />
      <div style={{ position: "absolute", top: 30, left: 0, zIndex: 101, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, padding: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.15)", display: "flex", gap: 4, flexWrap: "wrap", width: 140 }}>
        {COLORS.map(c => (
          <button key={c} onClick={() => onPick(c)} style={{ width: 20, height: 20, borderRadius: 4, background: c, border: c === "#fff" ? `1px solid ${BORDER}` : "none", cursor: "pointer", padding: 0 }} />
        ))}
        <input type="color" onChange={e => onPick(e.target.value)} style={{ width: 24, height: 20, border: "none", padding: 0, cursor: "pointer", borderRadius: 4 }} title="Autre couleur" />
      </div>
    </>
  );
}
