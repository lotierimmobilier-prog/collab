"use client";
import { useState, useEffect, useRef } from "react";
import { LocalEvent } from "./PlanningBoard";

const GOLD    = "#B8966A";
const BORDER  = "#E6E1D9";

const COLORS = [
  { value: "#B8966A", label: "Or" },
  { value: "#0891b2", label: "Bleu" },
  { value: "#059669", label: "Vert" },
  { value: "#dc2626", label: "Rouge" },
  { value: "#d97706", label: "Ambre" },
  { value: "#db2777", label: "Rose" },
  { value: "#7c3aed", label: "Violet" },
  { value: "#374151", label: "Gris" },
];

const EVENT_TYPES = [
  { value: "rdv",       label: "Rendez-vous", icon: "🤝" },
  { value: "visite",    label: "Visite",       icon: "🏠" },
  { value: "edl",       label: "État des lieux", icon: "📋" },
  { value: "signature", label: "Signature",    icon: "✍️" },
  { value: "formation", label: "Formation",    icon: "📚" },
  { value: "autre",     label: "Autre",        icon: "📌" },
];

interface Attendee { type: "user" | "contact"; id?: string; name: string; email: string; }
interface User { id: string; prenom: string; nom: string; email: string; }

function toInputDate(d: Date) { return d.toISOString().slice(0, 10); }
function toInputTime(d: Date) { return d.toTimeString().slice(0, 5); }

export default function EventModal({ defaultDate, event, onClose, onSave }: {
  defaultDate: Date;
  event?: LocalEvent | null;
  onClose: () => void;
  onSave: (e: LocalEvent & { attendees?: Attendee[] }) => void;
}) {
  const isEdit = !!event;
  const [f, setF] = useState({
    title:       event?.title       ?? "",
    date:        event ? toInputDate(new Date(event.start)) : toInputDate(defaultDate),
    startTime:   event ? toInputTime(new Date(event.start)) : toInputTime(defaultDate),
    endTime:     event ? toInputTime(new Date(event.end))   : String(defaultDate.getHours() + 1).padStart(2,"0") + ":" + toInputTime(defaultDate).slice(3),
    allDay:      false,
    location:    event?.location    ?? "",
    description: event?.description ?? "",
    color:       event?.color       ?? GOLD,
    type:        "rdv",
  });
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [users, setUsers]         = useState<User[]>([]);
  const [search, setSearch]       = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [manualEmail, setManualEmail] = useState({ name: "", email: "" });
  const [saving, setSaving]       = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/users").then(r => r.json()).then((us: (User & { active: boolean })[]) => setUsers(us.filter(u => u.active))).catch(() => {});
  }, []);

  useEffect(() => {
    function h(e: MouseEvent) { if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setShowPicker(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const filteredUsers = users.filter(u =>
    `${u.prenom} ${u.nom} ${u.email}`.toLowerCase().includes(search.toLowerCase()) &&
    !attendees.find(a => a.id === u.id)
  );

  function set(k: string, v: string | boolean) { setF(p => ({ ...p, [k]: v })); }

  function addUser(u: User) {
    setAttendees(p => [...p, { type: "user", id: u.id, name: `${u.prenom} ${u.nom}`, email: u.email }]);
    setSearch(""); setShowPicker(false);
  }

  function addContact() {
    if (!manualEmail.name.trim() || !manualEmail.email.trim()) return;
    setAttendees(p => [...p, { type: "contact", name: manualEmail.name.trim(), email: manualEmail.email.trim() }]);
    setManualEmail({ name: "", email: "" });
  }

  function removeAttendee(idx: number) { setAttendees(p => p.filter((_, i) => i !== idx)); }

  async function submit() {
    if (!f.title.trim() || saving) return;
    setSaving(true);
    const start = f.allDay ? f.date : `${f.date}T${f.startTime}:00`;
    const end   = f.allDay ? f.date : `${f.date}T${f.endTime}:00`;

    try {
      const payload = { title: f.title.trim(), description: f.description || undefined, location: f.location || undefined, start, end, allDay: f.allDay, color: f.color, type: f.type, attendees };
      const r = await fetch(isEdit ? `/api/calendar/${event!.id.replace("local-","")}` : "/api/calendar", {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (r.ok) {
        const saved = await r.json();
        onSave({
          id: `local-${saved.id}`, title: saved.title, start: saved.start, end: saved.end,
          color: saved.color, location: saved.location, description: saved.description,
          type: "local", attendees,
        });
      }
    } finally { setSaving(false); }
  }

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 40 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 520, background: "#fff", borderRadius: 16, zIndex: 50, boxShadow: "0 20px 60px rgba(0,0,0,0.18)", overflow: "hidden" }}>
        {/* Barre de couleur */}
        <div style={{ height: 5, background: f.color, transition: "background 0.2s" }} />

        <div style={{ padding: "16px 20px", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: "#111827" }}>{isEdit ? "Modifier l'événement" : "Nouvel événement"}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af" }}>×</button>
        </div>

        <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 13, maxHeight: "70vh", overflowY: "auto" }}>
          {/* Titre */}
          <input autoFocus value={f.title} onChange={e => set("title", e.target.value)} onKeyDown={e => e.key === "Enter" && submit()}
            placeholder="Titre de l'événement *"
            style={{ width: "100%", fontSize: 17, fontWeight: 600, border: "none", borderBottom: `2px solid ${BORDER}`, borderRadius: 0, padding: "4px 0", outline: "none", background: "transparent", boxSizing: "border-box", fontFamily: "inherit" }} />

          {/* Type */}
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {EVENT_TYPES.map(t => (
              <button key={t.value} onClick={() => set("type", t.value)} style={{
                padding: "4px 10px", fontSize: 11, borderRadius: 20, cursor: "pointer", display: "flex", alignItems: "center", gap: 4,
                border: `1px solid ${f.type === t.value ? GOLD : BORDER}`,
                background: f.type === t.value ? "#F7F0E6" : "#fff",
                color: f.type === t.value ? GOLD : "#6b7280",
                fontWeight: f.type === t.value ? 600 : 400,
              }}><span>{t.icon}</span>{t.label}</button>
            ))}
          </div>

          {/* Date/heure */}
          <div style={{ display: "grid", gridTemplateColumns: f.allDay ? "1fr" : "1fr 1fr 1fr", gap: 10 }}>
            <F label="📅 Date"><input type="date" value={f.date} onChange={e => set("date", e.target.value)} style={inp} /></F>
            {!f.allDay && <>
              <F label="🕐 Début"><input type="time" value={f.startTime} onChange={e => set("startTime", e.target.value)} style={inp} /></F>
              <F label="🕑 Fin"><input type="time" value={f.endTime} onChange={e => set("endTime", e.target.value)} style={inp} /></F>
            </>}
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "#374151" }}>
            <input type="checkbox" checked={f.allDay} onChange={e => set("allDay", e.target.checked)} />Toute la journée
          </label>

          {/* Lieu */}
          <F label="📍 Lieu">
            <input value={f.location} onChange={e => set("location", e.target.value)} placeholder="Adresse ou lieu…" style={{ ...inp, width: "100%" }} />
          </F>

          {/* Description */}
          <F label="📝 Description">
            <textarea value={f.description} onChange={e => set("description", e.target.value)} placeholder="Détails de l'événement…" rows={2} style={{ ...inp, height: "auto", padding: "8px 10px", resize: "none", width: "100%", lineHeight: 1.5 }} />
          </F>

          {/* Participants */}
          <F label="👥 Participants">
            {/* Utilisateurs de l'agence */}
            <div ref={pickerRef} style={{ position: "relative" }}>
              <input value={search} onChange={e => { setSearch(e.target.value); setShowPicker(true); }}
                onFocus={() => setShowPicker(true)}
                placeholder="Mentionner un collègue…"
                style={{ ...inp, width: "100%" }} />
              {showPicker && filteredUsers.length > 0 && (
                <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, boxShadow: "0 8px 24px rgba(0,0,0,0.1)", zIndex: 10, maxHeight: 160, overflowY: "auto" }}>
                  {filteredUsers.slice(0, 8).map(u => (
                    <div key={u.id} onClick={() => addUser(u)} style={{ padding: "8px 12px", cursor: "pointer", display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: "#374151" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "#F7F0E6")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                    >
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: GOLD + "30", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: GOLD }}>
                        {u.prenom[0]}{u.nom[0]}
                      </div>
                      <div><div style={{ fontWeight: 500 }}>{u.prenom} {u.nom}</div><div style={{ fontSize: 11, color: "#9ca3af" }}>{u.email}</div></div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Contact externe */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 6, marginTop: 6 }}>
              <input value={manualEmail.name} onChange={e => setManualEmail(p => ({ ...p, name: e.target.value }))} placeholder="Nom contact" style={{ ...inp, fontSize: 12 }} />
              <input value={manualEmail.email} onChange={e => setManualEmail(p => ({ ...p, email: e.target.value }))} placeholder="Email contact" type="email" style={{ ...inp, fontSize: 12 }} />
              <button onClick={addContact} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "0 10px", cursor: "pointer", fontSize: 12 }}>+ Ajouter</button>
            </div>

            {/* Liste des participants */}
            {attendees.length > 0 && (
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                {attendees.map((a, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: "#f9fafb", borderRadius: 8, padding: "6px 10px" }}>
                    <span style={{ fontSize: 13 }}>{a.type === "user" ? "👤" : "✉️"}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 500, color: "#111827" }}>{a.name}</div>
                      <div style={{ fontSize: 11, color: "#9ca3af" }}>{a.email}</div>
                    </div>
                    <button onClick={() => removeAttendee(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 14 }}>×</button>
                  </div>
                ))}
              </div>
            )}
            {attendees.length > 0 && (
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
                📧 Une invitation email sera envoyée à chaque participant
              </div>
            )}
          </F>

          {/* Couleur */}
          <F label="🎨 Couleur">
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {COLORS.map(c => (
                <div key={c.value} onClick={() => set("color", c.value)} title={c.label} style={{ width: 26, height: 26, borderRadius: "50%", background: c.value, cursor: "pointer", border: f.color === c.value ? `3px solid white` : "3px solid transparent", outline: f.color === c.value ? `2px solid ${c.value}` : "none", boxSizing: "border-box", transition: "all .1s" }} />
              ))}
            </div>
          </F>
        </div>

        <div style={{ padding: "14px 20px", borderTop: `1px solid ${BORDER}`, display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onClose} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer" }}>Annuler</button>
          <button onClick={submit} disabled={!f.title.trim() || saving} style={{ background: f.title.trim() && !saving ? f.color : "#e5e7eb", color: f.title.trim() && !saving ? "#fff" : "#9ca3af", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 500, cursor: f.title.trim() && !saving ? "pointer" : "default", transition: "background 0.2s" }}>
            {saving ? "Enregistrement…" : isEdit ? "Modifier" : "Créer l'événement"}
          </button>
        </div>
      </div>
    </>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div style={{ fontSize: 11, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 5 }}>{label}</div>{children}</div>;
}

const inp: React.CSSProperties = { width: "100%", height: 36, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "0 10px", fontSize: 13, outline: "none", background: "#f9fafb", fontFamily: "inherit", boxSizing: "border-box" };
