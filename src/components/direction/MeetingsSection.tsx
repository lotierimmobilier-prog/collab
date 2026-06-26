"use client";
import { useCallback, useEffect, useRef, useState } from "react";

const GOLD = "#B8966A"; const DARK = "#1C1A17"; const BORDER = "#E6E1D9"; const RED = "#9B2C2C";

interface MeetingDocMeta { id: string; name: string; mime: string; kind: "pdf" | "audio"; size: number; data?: string }
interface Meeting {
  id: string; title: string; date: string; participants: string | null; summary: string | null;
  documents: MeetingDocMeta[];
}

const fmtDate = (v: string) => new Date(v).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
const fmtSize = (n: number) => n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} Mo` : `${Math.max(1, Math.round(n / 1024))} Ko`;

export default function MeetingsSection() {
  const [items, setItems] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Meeting | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [full, setFull] = useState<Record<string, Meeting>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/direction/meetings");
      const d = await r.json();
      setItems(d.items ?? []);
    } catch { setItems([]); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function toggleOpen(id: string) {
    if (openId === id) { setOpenId(null); return; }
    setOpenId(id);
    if (!full[id]) {
      const r = await fetch(`/api/direction/meetings?id=${id}`);
      const d = await r.json();
      if (d.meeting) setFull(f => ({ ...f, [id]: d.meeting }));
    }
  }

  async function remove(id: string) {
    if (!confirm("Supprimer ce compte rendu et ses pièces jointes ?")) return;
    await fetch(`/api/direction/meetings?id=${id}`, { method: "DELETE" });
    setItems(p => p.filter(m => m.id !== id));
  }

  function openFile(doc: MeetingDocMeta) {
    if (!doc.data) return;
    // data est une data-URL base64 → ouverture dans un nouvel onglet
    const a = document.createElement("a");
    a.href = doc.data; a.target = "_blank"; a.rel = "noopener noreferrer";
    if (doc.kind === "pdf") a.download = doc.name;
    a.click();
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: DARK }}>Comptes rendus de réunion de direction <span style={{ color: "#9ca3af", fontWeight: 400 }}>({items.length})</span></span>
        <button onClick={() => { setEditing(null); setShowForm(true); }} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>+ Ajouter</button>
      </div>

      {loading ? (
        <div style={{ color: "#9ca3af", fontSize: 13, textAlign: "center", padding: 40 }}>Chargement…</div>
      ) : items.length === 0 ? (
        <div style={{ color: "#9ca3af", fontSize: 13, textAlign: "center", padding: 40, background: "#fff", borderRadius: 10, border: `1px solid ${BORDER}` }}>
          Aucun compte rendu. Cliquez sur « + Ajouter » pour déposer un PDF ou un enregistrement audio.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map(m => {
            const isOpen = openId === m.id;
            const f = full[m.id];
            return (
              <div key={m.id} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: DARK }}>{m.title}</div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 3 }}>
                      {fmtDate(m.date)}{m.participants ? ` · ${m.participants}` : ""}
                    </div>
                    {m.summary && <div style={{ fontSize: 12.5, color: "#4b5563", marginTop: 6, whiteSpace: "pre-wrap" }}>{m.summary}</div>}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                      {m.documents.map(d => (
                        <span key={d.id} style={{ background: d.kind === "audio" ? "#EAF2EC" : "#F2F1EC", color: d.kind === "audio" ? "#2F6B46" : "#6b7280", borderRadius: 6, padding: "3px 9px", fontSize: 11, fontWeight: 600 }}>
                          {d.kind === "audio" ? "♪ " : "PDF · "}{d.name} ({fmtSize(d.size)})
                        </span>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                    {m.documents.length > 0 && <button onClick={() => toggleOpen(m.id)} style={txtBtn}>{isOpen ? "Réduire" : "Consulter"}</button>}
                    <button onClick={() => { setEditing(m); setShowForm(true); }} style={txtBtn}>Modifier</button>
                    <button onClick={() => remove(m.id)} style={{ ...txtBtn, color: RED }}>Supprimer</button>
                  </div>
                </div>

                {isOpen && (
                  <div style={{ marginTop: 12, borderTop: `1px solid ${BORDER}`, paddingTop: 12, display: "flex", flexDirection: "column", gap: 12 }}>
                    {!f ? <div style={{ fontSize: 12, color: "#9ca3af" }}>Chargement des pièces…</div> : f.documents.map(d => (
                      <div key={d.id}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: DARK, marginBottom: 5 }}>{d.name}</div>
                        {d.kind === "audio"
                          ? <audio controls src={d.data} style={{ width: "100%", maxWidth: 460 }} />
                          : <button onClick={() => openFile(d)} style={{ ...txtBtn, border: `1px solid ${BORDER}`, padding: "6px 12px" }}>Ouvrir le PDF →</button>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showForm && <MeetingForm meeting={editing} onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); setFull({}); setOpenId(null); load(); }} />}
    </div>
  );
}

function MeetingForm({ meeting, onClose, onSaved }: { meeting: Meeting | null; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!meeting;
  const [title, setTitle] = useState(meeting?.title ?? "Réunion de direction");
  const [date, setDate] = useState(meeting?.date ? meeting.date.slice(0, 10) : new Date().toISOString().slice(0, 10));
  const [participants, setParticipants] = useState(meeting?.participants ?? "");
  const [summary, setSummary] = useState(meeting?.summary ?? "");
  const [docs, setDocs] = useState<MeetingDocMeta[]>([]);     // nouvelles pièces
  const [keepIds, setKeepIds] = useState<string[]>(meeting?.documents.map(d => d.id) ?? []);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function addFiles(files: FileList) {
    setErr("");
    for (const file of Array.from(files)) {
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      const isAudio = file.type.startsWith("audio/") || /\.(mp3|m4a|wav|ogg|aac|webm)$/i.test(file.name);
      if (!isPdf && !isAudio) { setErr(`« ${file.name} » ignoré : seuls les PDF et fichiers audio sont acceptés.`); continue; }
      const data = await new Promise<string>((res, rej) => {
        const fr = new FileReader(); fr.onload = () => res(String(fr.result)); fr.onerror = rej; fr.readAsDataURL(file);
      });
      setDocs(d => [...d, { id: Math.random().toString(36).slice(2), name: file.name, mime: file.type, kind: isAudio ? "audio" : "pdf", size: file.size, data }]);
    }
  }

  async function save() {
    if (!date) { setErr("La date est requise."); return; }
    setSaving(true); setErr("");
    try {
      // En édition : on récupère le CR complet pour conserver les pièces gardées (avec leur data).
      let kept: MeetingDocMeta[] = [];
      if (isEdit && keepIds.length) {
        const r = await fetch(`/api/direction/meetings?id=${meeting!.id}`);
        const d = await r.json();
        kept = ((d.meeting?.documents ?? []) as MeetingDocMeta[]).filter(x => keepIds.includes(x.id));
      }
      const documents = [...kept, ...docs];
      const payload = { title, date, participants, summary, documents };
      const r = isEdit
        ? await fetch("/api/direction/meetings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: meeting!.id, ...payload }) })
        : await fetch("/api/direction/meetings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); setErr(d.error || "Erreur"); return; }
      onSaved();
    } catch { setErr("Erreur réseau"); }
    finally { setSaving(false); }
  }

  const existing = (meeting?.documents ?? []).filter(d => keepIds.includes(d.id));

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: 520, maxWidth: "94vw", maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ background: DARK, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>{isEdit ? "Modifier le compte rendu" : "Nouveau compte rendu"}</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#9ca3af", fontSize: 20, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 12 }}>
          <Field label="Intitulé"><input value={title} onChange={e => setTitle(e.target.value)} style={inp} /></Field>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Field label="Date"><input type="date" value={date} onChange={e => setDate(e.target.value)} style={inp} /></Field>
            <Field label="Participants"><input value={participants} onChange={e => setParticipants(e.target.value)} placeholder="Noms" style={inp} /></Field>
          </div>
          <Field label="Notes / ordre du jour"><textarea value={summary} onChange={e => setSummary(e.target.value)} rows={3} style={{ ...inp, height: "auto", padding: "8px 10px", resize: "vertical" }} /></Field>

          <Field label="Pièces jointes (PDF ou audio)">
            <input ref={fileRef} type="file" multiple accept=".pdf,application/pdf,audio/*" style={{ display: "none" }}
              onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ""; }} />
            <button onClick={() => fileRef.current?.click()} style={{ ...inp, height: 38, cursor: "pointer", textAlign: "left", color: GOLD, fontWeight: 600 }}>+ Ajouter un PDF ou un audio</button>
            <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 8 }}>
              {existing.map(d => (
                <DocChip key={d.id} name={d.name} kind={d.kind} size={d.size} onRemove={() => setKeepIds(ids => ids.filter(x => x !== d.id))} />
              ))}
              {docs.map(d => (
                <DocChip key={d.id} name={d.name} kind={d.kind} size={d.size} isNew onRemove={() => setDocs(p => p.filter(x => x.id !== d.id))} />
              ))}
            </div>
          </Field>

          {err && <span style={{ color: RED, fontSize: 12 }}>{err}</span>}
          <button onClick={save} disabled={saving} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "10px 0", fontSize: 14, fontWeight: 600, cursor: "pointer", marginTop: 4 }}>
            {saving ? "Enregistrement…" : isEdit ? "Enregistrer les modifications" : "Créer le compte rendu"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DocChip({ name, kind, size, isNew, onRemove }: { name: string; kind: string; size: number; isNew?: boolean; onRemove: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "6px 10px", fontSize: 12 }}>
      <span style={{ fontWeight: 600, color: kind === "audio" ? "#2F6B46" : "#6b7280" }}>{kind === "audio" ? "♪" : "PDF"}</span>
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: DARK }}>{name}</span>
      <span style={{ color: "#9ca3af" }}>{fmtSize(size)}{isNew ? " · nouveau" : ""}</span>
      <button onClick={onRemove} title="Retirer" style={{ background: "none", border: "none", color: "#d1d5db", fontSize: 16, cursor: "pointer" }}>×</button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      {children}
    </div>
  );
}

const inp: React.CSSProperties = { width: "100%", height: 36, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "0 10px", fontSize: 13, outline: "none", background: "#f9fafb", fontFamily: "inherit", boxSizing: "border-box" };
const txtBtn: React.CSSProperties = { background: "none", border: "none", color: "#6b7280", fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: "4px 6px" };
