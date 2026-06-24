"use client";
import { useState } from "react";
import { LocalEvent } from "./PlanningBoard";

const COLORS = [
  { value: "#B8966A", label: "Violet" },
  { value: "#0891b2", label: "Cyan" },
  { value: "#059669", label: "Vert" },
  { value: "#dc2626", label: "Rouge" },
  { value: "#d97706", label: "Ambre" },
  { value: "#db2777", label: "Rose" },
  { value: "#374151", label: "Gris" },
];

const EVENT_TYPES = [
  { value: "rdv", label: "Rendez-vous" },
  { value: "visite", label: "Visite" },
  { value: "edl", label: "État des lieux" },
  { value: "signature", label: "Signature" },
  { value: "formation", label: "Formation" },
  { value: "autre", label: "Autre" },
];

function toInputDate(d: Date) { return d.toISOString().slice(0, 10); }
function toInputTime(d: Date) { return d.toTimeString().slice(0, 5); }

export default function EventModal({ defaultDate, onClose, onSave }: {
  defaultDate: Date;
  onClose: () => void;
  onSave: (e: LocalEvent) => void;
}) {
  const [f, setF] = useState({
    title: "",
    date: toInputDate(defaultDate),
    startTime: toInputTime(defaultDate),
    endTime: String(defaultDate.getHours() + 1).padStart(2, "0") + ":" + toInputTime(defaultDate).slice(3),
    allDay: false,
    location: "",
    description: "",
    color: "#B8966A",
    type: "rdv",
  });

  function set(k: string, v: string | boolean) { setF(p => ({ ...p, [k]: v })); }

  function submit() {
    if (!f.title.trim()) return;
    const start = f.allDay ? f.date : `${f.date}T${f.startTime}:00`;
    const end   = f.allDay ? f.date : `${f.date}T${f.endTime}:00`;
    onSave({
      id: Date.now().toString(),
      title: f.title.trim(),
      start, end,
      color: f.color,
      location: f.location || undefined,
      description: f.description || undefined,
      type: "local",
    });
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 40 }} />
      <div style={{
        position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)",
        width: 480, background: "#fff", borderRadius: 14, zIndex: 50,
        boxShadow: "0 20px 60px rgba(0,0,0,0.15)", overflow: "hidden",
      }}>
        {/* Color bar */}
        <div style={{ height: 5, background: f.color }} />

        <div style={{ padding: "16px 20px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 600, fontSize: 15 }}>Nouvel événement</span>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af" }}>×</button>
        </div>

        <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Title */}
          <input
            autoFocus
            value={f.title}
            onChange={e => set("title", e.target.value)}
            onKeyDown={e => e.key === "Enter" && submit()}
            placeholder="Titre de l'événement *"
            style={{ ...inp, fontSize: 15, fontWeight: 500, border: "none", borderBottom: "2px solid #e5e7eb", borderRadius: 0, paddingLeft: 0, background: "transparent" }}
          />

          {/* Type */}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {EVENT_TYPES.map(t => (
              <button key={t.value} onClick={() => set("type", t.value)} style={{
                padding: "4px 10px", fontSize: 11, borderRadius: 6, cursor: "pointer",
                border: `1px solid ${f.type === t.value ? "#B8966A" : "#e5e7eb"}`,
                background: f.type === t.value ? "#F7F0E6" : "#fff",
                color: f.type === t.value ? "#B8966A" : "#6b7280",
                fontWeight: f.type === t.value ? 600 : 400,
              }}>{t.label}</button>
            ))}
          </div>

          {/* Date & time */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <F label="Date"><input type="date" value={f.date} onChange={e => set("date", e.target.value)} style={inp} /></F>
            {!f.allDay && (
              <>
                <F label="Début"><input type="time" value={f.startTime} onChange={e => set("startTime", e.target.value)} style={inp} /></F>
                <F label="Fin"><input type="time" value={f.endTime} onChange={e => set("endTime", e.target.value)} style={inp} /></F>
              </>
            )}
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "#374151" }}>
            <input type="checkbox" checked={f.allDay} onChange={e => set("allDay", e.target.checked)} />
            Toute la journée
          </label>

          <F label="Lieu">
            <input value={f.location} onChange={e => set("location", e.target.value)} placeholder="Adresse ou lieu…" style={{ ...inp, width: "100%" }} />
          </F>

          <F label="Description">
            <textarea value={f.description} onChange={e => set("description", e.target.value)} placeholder="Détails…" rows={2} style={{ ...inp, height: "auto", padding: "8px 10px", resize: "none", width: "100%" }} />
          </F>

          {/* Color picker */}
          <F label="Couleur">
            <div style={{ display: "flex", gap: 8 }}>
              {COLORS.map(c => (
                <div key={c.value} onClick={() => set("color", c.value)} title={c.label} style={{
                  width: 24, height: 24, borderRadius: "50%", background: c.value, cursor: "pointer",
                  border: f.color === c.value ? `3px solid ${c.value}` : "3px solid transparent",
                  outline: f.color === c.value ? "2px solid white" : "none",
                  boxSizing: "border-box", transition: "all .1s",
                }} />
              ))}
            </div>
          </F>
        </div>

        <div style={{ padding: "14px 20px", borderTop: "1px solid #e5e7eb", display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onClose} style={{ background: "none", border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>Annuler</button>
          <button onClick={submit} disabled={!f.title.trim()} style={{ background: f.title.trim() ? f.color : "#e5e7eb", color: f.title.trim() ? "#fff" : "#9ca3af", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
            Créer l'événement
          </button>
        </div>
      </div>
    </>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>{label}</div>{children}</div>;
}

const inp: React.CSSProperties = { width: "100%", height: 36, border: "1px solid #e5e7eb", borderRadius: 8, padding: "0 10px", fontSize: 13, outline: "none", background: "#f9fafb", fontFamily: "inherit", boxSizing: "border-box" };
