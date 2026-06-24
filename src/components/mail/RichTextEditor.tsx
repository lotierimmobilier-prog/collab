"use client";
import { useEffect, useRef, useState } from "react";

const GOLD = "#B8966A"; const BORDER = "#E6E1D9";
const COLORS = ["#111827","#374151","#6b7280","#B8966A","#2563EB","#059669","#DC2626","#7C3AED","#D97706","#ffffff"];

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
  maxHeight?: number;
  showHtmlToggle?: boolean;  // afficher le bouton </> HTML
  compact?: boolean;          // toolbar plus compacte (pour signature)
  autoFocus?: boolean;
}

function ColorPicker({ onPick, onClose }: { onPick: (c: string) => void; onClose: () => void }) {
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 200 }} />
      <div style={{ position: "absolute", top: 30, left: 0, zIndex: 201, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, padding: 8, boxShadow: "0 4px 20px rgba(0,0,0,0.15)", display: "flex", gap: 4, flexWrap: "wrap", width: 146 }}>
        {COLORS.map(c => (
          <button key={c} onClick={() => onPick(c)} style={{ width: 20, height: 20, borderRadius: 4, background: c, border: c === "#ffffff" ? `1px solid ${BORDER}` : "1px solid transparent", cursor: "pointer", padding: 0 }} />
        ))}
        <input type="color" onChange={e => onPick(e.target.value)} style={{ width: 24, height: 20, border: "none", padding: 0, cursor: "pointer", borderRadius: 4 }} title="Autre couleur" />
      </div>
    </>
  );
}

export default function RichTextEditor({ value, onChange, placeholder = "Rédigez votre message…", minHeight = 160, maxHeight, showHtmlToggle = true, compact = false, autoFocus = false }: Props) {
  const [mode, setMode] = useState<"visual" | "html">("visual");
  const [htmlSource, setHtmlSource] = useState(value);
  const [colorTarget, setColorTarget] = useState<"text" | "bg" | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const fileRef   = useRef<HTMLInputElement>(null);
  const imgUrlRef = useRef<HTMLInputElement>(null);
  const [showImgUrl, setShowImgUrl] = useState(false);

  // Init
  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = value;
    setHtmlSource(value);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function switchToHtml() {
    if (editorRef.current) setHtmlSource(editorRef.current.innerHTML);
    setMode("html");
  }
  function switchToVisual() {
    setMode("visual");
    setTimeout(() => { if (editorRef.current) editorRef.current.innerHTML = htmlSource; }, 0);
  }

  function emit() {
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }
  function handleHtmlChange(v: string) { setHtmlSource(v); onChange(v); }

  function exec(cmd: string, val?: string) {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    emit();
  }
  function insertHtml(html: string) {
    editorRef.current?.focus();
    document.execCommand("insertHTML", false, html);
    emit();
  }

  function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => insertHtml(`<img src="${ev.target?.result as string}" alt="" style="max-width:100%;vertical-align:middle;border-radius:4px"/>`);
    reader.readAsDataURL(file);
    e.target.value = "";
  }
  function insertImageUrl() {
    const url = imgUrlRef.current?.value.trim(); if (!url) return;
    insertHtml(`<img src="${url}" alt="" style="max-width:100%;vertical-align:middle;border-radius:4px"/>`);
    if (imgUrlRef.current) imgUrlRef.current.value = "";
    setShowImgUrl(false);
  }
  function insertLink() {
    const sel = window.getSelection()?.toString();
    const url  = prompt("URL du lien :"); if (!url) return;
    const text = sel || prompt("Texte du lien :") || url;
    insertHtml(`<a href="${url}" style="color:${GOLD}">${text}</a>`);
  }
  function insertTable() {
    insertHtml(`<table style="border-collapse:collapse;font-size:13px;margin:8px 0"><tr><th style="border:1px solid #e5e7eb;padding:6px 12px;background:#f9fafb"></th><th style="border:1px solid #e5e7eb;padding:6px 12px;background:#f9fafb"></th></tr><tr><td style="border:1px solid #e5e7eb;padding:6px 12px"></td><td style="border:1px solid #e5e7eb;padding:6px 12px"></td></tr></table>`);
  }

  const B: React.CSSProperties = { width: 26, height: 26, border: `1px solid ${BORDER}`, borderRadius: 5, background: "#fff", cursor: "pointer", fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", color: "#374151", padding: 0, flexShrink: 0 };
  const sep = <div style={{ width: 1, height: 18, background: BORDER, margin: "0 2px", flexShrink: 0 }} />;

  const editorStyle: React.CSSProperties = {
    minHeight,
    ...(maxHeight ? { maxHeight, overflowY: "auto" } : {}),
    border: `1px solid ${BORDER}`,
    borderRadius: mode === "visual" ? "0 0 8px 8px" : 8,
    padding: "10px 14px",
    fontSize: 13,
    outline: "none",
    lineHeight: 1.7,
    background: "#fff",
    fontFamily: "inherit",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {/* Toolbar */}
      <div style={{ display: "flex", gap: compact ? 2 : 3, flexWrap: "wrap", background: "#FAFAF8", border: `1px solid ${BORDER}`, borderBottom: "none", borderRadius: "8px 8px 0 0", padding: compact ? "5px 6px" : "7px 8px", alignItems: "center" }}>

        {/* Formatage */}
        <button style={B} onClick={() => exec("bold")} title="Gras"><b style={{ fontSize: 13 }}>B</b></button>
        <button style={B} onClick={() => exec("italic")} title="Italique"><i style={{ fontSize: 13 }}>I</i></button>
        <button style={B} onClick={() => exec("underline")} title="Souligné"><u style={{ fontSize: 12 }}>U</u></button>
        <button style={B} onClick={() => exec("strikeThrough")} title="Barré"><s style={{ fontSize: 11 }}>S</s></button>
        {sep}

        {/* Listes */}
        <button style={B} onClick={() => exec("insertUnorderedList")} title="Liste à puces">☰</button>
        <button style={B} onClick={() => exec("insertOrderedList")} title="Liste numérotée">1.</button>
        {sep}

        {/* Taille */}
        <select onChange={e => exec("fontSize", e.target.value)} defaultValue="3"
          style={{ height: 26, border: `1px solid ${BORDER}`, borderRadius: 5, fontSize: 11, padding: "0 3px", background: "#fff", cursor: "pointer", flexShrink: 0 }}>
          {[["1","8px"],["2","10px"],["3","12px"],["4","14px"],["5","18px"],["6","24px"],["7","32px"]].map(([v,l]) =>
            <option key={v} value={v}>{l}</option>
          )}
        </select>

        {/* Style paragraphe */}
        {!compact && (
          <select onChange={e => exec("formatBlock", e.target.value)} defaultValue="p"
            style={{ height: 26, border: `1px solid ${BORDER}`, borderRadius: 5, fontSize: 11, padding: "0 3px", background: "#fff", cursor: "pointer", flexShrink: 0 }}>
            <option value="p">Paragraphe</option>
            <option value="h1">Titre 1</option>
            <option value="h2">Titre 2</option>
            <option value="h3">Titre 3</option>
            <option value="blockquote">Citation</option>
          </select>
        )}
        {sep}

        {/* Alignement */}
        <button style={B} onClick={() => exec("justifyLeft")} title="Gauche">⬅</button>
        <button style={B} onClick={() => exec("justifyCenter")} title="Centre">≡</button>
        <button style={B} onClick={() => exec("justifyRight")} title="Droite">➡</button>
        {sep}

        {/* Couleurs */}
        <div style={{ position: "relative" }}>
          <button style={{ ...B, gap: 1, flexDirection: "column", paddingTop: 2 }} onClick={() => setColorTarget(p => p === "text" ? null : "text")} title="Couleur texte">
            <span style={{ fontWeight: 800, fontSize: 13, lineHeight: 1 }}>A</span>
            <span style={{ width: 14, height: 3, background: "#DC2626", borderRadius: 1 }} />
          </button>
          {colorTarget === "text" && <ColorPicker onPick={c => { exec("foreColor", c); setColorTarget(null); }} onClose={() => setColorTarget(null)} />}
        </div>
        <div style={{ position: "relative" }}>
          <button style={{ ...B }} onClick={() => setColorTarget(p => p === "bg" ? null : "bg")} title="Couleur fond">
            <span style={{ background: "#FDE68A", borderRadius: 2, padding: "0 3px", fontSize: 10, fontWeight: 700 }}>A</span>
          </button>
          {colorTarget === "bg" && <ColorPicker onPick={c => { exec("hiliteColor", c); setColorTarget(null); }} onClose={() => setColorTarget(null)} />}
        </div>
        {sep}

        {/* Image fichier */}
        <input ref={fileRef} type="file" accept="image/*" onChange={handleImageFile} style={{ display: "none" }} />
        <button style={B} onClick={() => fileRef.current?.click()} title="Image depuis fichier">🖼</button>

        {/* Image URL */}
        <div style={{ position: "relative" }}>
          <button style={{ ...B, fontSize: 11, width: "auto", padding: "0 6px" }} onClick={() => setShowImgUrl(s => !s)} title="Image par URL">URL img</button>
          {showImgUrl && (
            <>
              <div onClick={() => setShowImgUrl(false)} style={{ position: "fixed", inset: 0, zIndex: 200 }} />
              <div style={{ position: "absolute", top: 30, left: 0, zIndex: 201, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, padding: 10, boxShadow: "0 4px 20px rgba(0,0,0,0.15)", display: "flex", gap: 6, width: 260 }}>
                <input ref={imgUrlRef} placeholder="https://…" autoFocus onKeyDown={e => e.key === "Enter" && insertImageUrl()} style={{ flex: 1, height: 28, border: `1px solid ${BORDER}`, borderRadius: 5, padding: "0 8px", fontSize: 12, outline: "none" }} />
                <button onClick={insertImageUrl} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 5, padding: "0 10px", fontSize: 12, cursor: "pointer" }}>OK</button>
              </div>
            </>
          )}
        </div>

        {/* Lien */}
        <button style={B} onClick={insertLink} title="Insérer lien">🔗</button>

        {/* Tableau */}
        {!compact && <button style={B} onClick={insertTable} title="Insérer tableau">⊞</button>}

        {/* Séparateur */}
        <button style={{ ...B, fontSize: 11, width: "auto", padding: "0 6px" }} onClick={() => insertHtml("<hr style='border:none;border-top:1px solid #e5e7eb;margin:10px 0'/>")} title="Ligne séparatrice">—</button>

        {sep}
        {/* Effacer */}
        <button style={{ ...B, color: "#9ca3af" }} onClick={() => exec("removeFormat")} title="Effacer le formatage">✕</button>

        {/* Mode HTML */}
        {showHtmlToggle && (
          <>
            <div style={{ flex: 1 }} />
            <button onClick={() => mode === "visual" ? switchToHtml() : switchToVisual()}
              style={{ ...B, width: "auto", padding: "0 8px", fontSize: 10, fontWeight: 700, color: mode === "html" ? GOLD : "#9ca3af", border: `1px solid ${mode === "html" ? GOLD : BORDER}` }}>
              {"{/}"}
            </button>
          </>
        )}
      </div>

      {/* Zone éditable */}
      {mode === "visual" && (
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          autoFocus={autoFocus}
          onInput={emit}
          data-placeholder={placeholder}
          style={editorStyle}
        />
      )}

      {/* Mode HTML source */}
      {mode === "html" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <textarea
            value={htmlSource}
            onChange={e => handleHtmlChange(e.target.value)}
            style={{ width: "100%", minHeight, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "10px 12px", fontSize: 12, fontFamily: "monospace", outline: "none", resize: "vertical", boxSizing: "border-box", background: "#1C1A17", color: "#d4d4d8", lineHeight: 1.7 }}
          />
          {htmlSource && (
            <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "12px 16px" }}>
              <div style={{ fontSize: 10, color: "#9ca3af", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>Aperçu</div>
              <div dangerouslySetInnerHTML={{ __html: htmlSource }} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
