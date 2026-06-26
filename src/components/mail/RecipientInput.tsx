"use client";
import { useEffect, useRef, useState } from "react";

interface ContactHit { id: string; prenom?: string | null; nom?: string | null; raisonSociale?: string | null; email?: string | null }
const nameOf = (c: ContactHit) => c.raisonSociale || [c.prenom, c.nom].filter(Boolean).join(" ") || c.email || "";

/**
 * Champ destinataire avec autocomplétion depuis l'annuaire : dès la 3ᵉ lettre
 * saisie (sur le dernier destinataire en cours), propose les contacts.
 * Gère plusieurs destinataires séparés par des virgules.
 */
export default function RecipientInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [hits, setHits] = useState<ContactHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  const lastToken = (v: string) => (v.split(",").pop() ?? "").trim();

  useEffect(() => {
    const token = lastToken(value);
    if (token.length < 3 || token.includes("@")) { setHits([]); setOpen(false); return; }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/contacts?q=${encodeURIComponent(token)}`);
        const d = await r.json();
        const list: ContactHit[] = (d.contacts ?? []).filter((c: ContactHit) => c.email).slice(0, 8);
        setHits(list); setOpen(list.length > 0); setActive(0);
      } catch { /* silencieux */ }
    }, 200);
    return () => clearTimeout(t);
  }, [value]);

  useEffect(() => {
    function h(e: MouseEvent) { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  function pick(c: ContactHit) {
    const parts = value.split(",");
    parts[parts.length - 1] = ` ${c.email}`;
    onChange(parts.join(",").replace(/^\s+/, "") + ", ");
    setOpen(false); setHits([]);
  }

  return (
    <div ref={boxRef} style={{ flex: 1, position: "relative" }}>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        onKeyDown={e => {
          if (!open || hits.length === 0) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActive(a => Math.min(a + 1, hits.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
          else if (e.key === "Enter" || e.key === "Tab") { if (hits[active]) { e.preventDefault(); pick(hits[active]); } }
          else if (e.key === "Escape") { setOpen(false); }
        }}
        style={{ width: "100%", border: "none", fontSize: 13, outline: "none", fontFamily: "inherit" }}
      />
      {open && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 40, background: "#fff", border: "1px solid #E6E1D9", borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.12)", marginTop: 4, maxHeight: 240, overflowY: "auto" }}>
          {hits.map((c, i) => (
            <div key={c.id} onMouseDown={e => { e.preventDefault(); pick(c); }} onMouseEnter={() => setActive(i)}
              style={{ padding: "7px 11px", cursor: "pointer", background: i === active ? "#F7F0E6" : "#fff", display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "#1C1A17" }}>{nameOf(c)}</span>
              <span style={{ fontSize: 11.5, color: "#6b7280" }}>{c.email}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
