"use client";
import { useState, useEffect, useRef } from "react";
import Sidebar from "@/components/Sidebar";

const GOLD = "#B8966A";
const COLORS = ["#B8966A","#059669","#2563EB","#7C3AED","#DC2626","#D97706"];
const colorForId = (id: string) => COLORS[id.charCodeAt(0) % COLORS.length];

interface User { id: string; prenom: string; nom: string; email: string; }
interface Call {
  id: string;
  title: string;
  description: string | null;
  status: string;
  tags: string[];
  createdAt: string;
  assigneeId?: string;
  assignee?: string;
  assigneeInitials?: string;
  assigneeColor?: string;
}

function getTag(tags: string[], prefix: string) {
  return tags.find(t => t.startsWith(prefix + ":"))?.slice(prefix.length + 1) ?? "";
}

function getCoIds(tags: string[]) {
  return tags.filter(t => t.startsWith("co:")).map(t => t.slice(3));
}

function initials(u: User) { return (u.prenom[0] + u.nom[0]).toUpperCase(); }

function Avatar({ label, color, size = 26 }: { label: string; color: string; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: color + "30", border: `2px solid ${color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.38, fontWeight: 700, color, flexShrink: 0 }}>
      {label}
    </div>
  );
}

export default function AppelsPage() {
  const [calls, setCalls]   = useState<Call[]>([]);
  const [users, setUsers]   = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState<"all"|"todo"|"done">("all");

  // Formulaire nouvel appel
  const [caller, setCaller]   = useState("");
  const [phone, setPhone]     = useState("");
  const [subject, setSubject] = useState("");
  const [notes, setNotes]     = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [coIds, setCoIds]     = useState<string[]>([]);
  const [saving, setSaving]   = useState(false);

  // Commentaire inline
  const [editId, setEditId]   = useState<string|null>(null);
  const [editComment, setEditComment] = useState("");

  const formRef = useRef<HTMLDivElement>(null);

  async function load() {
    setLoading(true);
    const r = await fetch("/api/tasks");
    if (r.ok) {
      const all: Call[] = await r.json();
      setCalls(all.filter(t => t.tags?.includes("type:appel")));
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    fetch("/api/users").then(r => r.json()).then((us: (User & { active: boolean })[]) => setUsers(us.filter(u => u.active))).catch(() => {});
  }, []);

  async function logCall() {
    if (!caller.trim() && !subject.trim()) return;
    setSaving(true);
    const tagList = [
      "type:appel",
      caller.trim() ? `caller:${caller.trim()}` : null,
      phone.trim()  ? `phone:${phone.trim()}`   : null,
      ...coIds.map(id => `co:${id}`),
    ].filter(Boolean) as string[];

    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title:       subject.trim() || `Appel de ${caller.trim()}`,
        description: notes.trim() || null,
        status:      "todo",
        priority:    "moyenne",
        assigneeId:  assigneeId || null,
        tags:        tagList,
      }),
    });
    setCaller(""); setPhone(""); setSubject(""); setNotes(""); setAssigneeId(""); setCoIds([]);
    setShowForm(false);
    setSaving(false);
    await load();
  }

  async function toggleStatus(call: Call) {
    const newStatus = call.status === "done" ? "todo" : "done";
    await fetch(`/api/tasks/${call.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    setCalls(p => p.map(c => c.id === call.id ? { ...c, status: newStatus } : c));
  }

  async function saveComment(call: Call) {
    await fetch(`/api/tasks/${call.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: editComment }),
    });
    setCalls(p => p.map(c => c.id === call.id ? { ...c, description: editComment } : c));
    setEditId(null);
  }

  async function deleteCall(id: string) {
    if (!confirm("Supprimer cet appel ?")) return;
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    setCalls(p => p.filter(c => c.id !== id));
  }

  const filtered = calls.filter(c => filterStatus === "all" || c.status === filterStatus);
  const nbNew    = calls.filter(c => c.status === "todo").length;
  const nbDone   = calls.filter(c => c.status === "done").length;

  return (
    <div style={{ display: "flex", height: "100vh", background: "#f9fafb", fontFamily: "'Inter', sans-serif" }}>
      <Sidebar active="appels" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "14px 24px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: 16, fontWeight: 700, color: "#111827", margin: 0 }}>📞 Appels téléphoniques</h1>
            <p style={{ fontSize: 12, color: "#6b7280", margin: 0, marginTop: 2 }}>
              {nbNew} à traiter · {nbDone} traité(s)
            </p>
          </div>
          <button onClick={() => setShowForm(true)} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
            + Enregistrer un appel
          </button>
        </div>

        {/* Filtres */}
        <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "8px 24px", display: "flex", gap: 6 }}>
          {([["all","Tous", calls.length],["todo","À traiter",nbNew],["done","Traités",nbDone]] as const).map(([v, l, n]) => (
            <button key={v} onClick={() => setFilterStatus(v)} style={{ border: "none", borderRadius: 20, padding: "4px 12px", fontSize: 12, fontWeight: filterStatus === v ? 600 : 400, background: filterStatus === v ? "#F7F0E6" : "transparent", color: filterStatus === v ? GOLD : "#6b7280", cursor: "pointer" }}>
              {l} <span style={{ fontSize: 11, opacity: 0.7 }}>({n})</span>
            </button>
          ))}
        </div>

        {/* Liste */}
        <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 60, color: "#9ca3af" }}>Chargement…</div>
          ) : filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, color: "#9ca3af" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📞</div>
              <div style={{ fontWeight: 600, color: "#374151" }}>Aucun appel enregistré</div>
              <div style={{ fontSize: 13, marginTop: 6 }}>Cliquez sur « Enregistrer un appel » pour commencer</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 800 }}>
              {filtered.map(call => {
                const callerName = getTag(call.tags, "caller");
                const phoneNum   = getTag(call.tags, "phone");
                const coAssigneeIds = getCoIds(call.tags);
                const coUsers    = coAssigneeIds.map(id => users.find(u => u.id === id)).filter(Boolean) as User[];
                const assigneeUser = call.assigneeId ? users.find(u => u.id === call.assigneeId) : null;
                const isDone     = call.status === "done";

                return (
                  <div key={call.id} style={{ background: "#fff", border: `1px solid ${isDone ? "#d1fae5" : "#e5e7eb"}`, borderLeft: `4px solid ${isDone ? "#059669" : GOLD}`, borderRadius: 12, padding: "14px 16px", opacity: isDone ? 0.8 : 1 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      {/* Checkbox statut */}
                      <button onClick={() => toggleStatus(call)} title={isDone ? "Marquer non traité" : "Marquer traité"} style={{ marginTop: 2, width: 22, height: 22, borderRadius: "50%", border: `2px solid ${isDone ? "#059669" : "#d1d5db"}`, background: isDone ? "#059669" : "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, flexShrink: 0 }}>
                        {isDone ? "✓" : ""}
                      </button>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Appelant + téléphone */}
                        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
                          {callerName && <span style={{ fontWeight: 700, fontSize: 14, color: "#111827", textDecoration: isDone ? "line-through" : "none" }}>{callerName}</span>}
                          {phoneNum   && <a href={`tel:${phoneNum}`} style={{ fontSize: 12, color: GOLD, textDecoration: "none", fontWeight: 500 }}>📞 {phoneNum}</a>}
                          <span style={{ fontSize: 11, color: "#9ca3af" }}>· {new Date(call.createdAt).toLocaleString("fr-FR", { day:"2-digit", month:"2-digit", hour:"2-digit", minute:"2-digit" })}</span>
                        </div>

                        {/* Objet */}
                        <div style={{ fontSize: 13, color: "#374151", marginBottom: 6 }}>{call.title}</div>

                        {/* Commentaire */}
                        {editId === call.id ? (
                          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                            <textarea value={editComment} onChange={e => setEditComment(e.target.value)} rows={2} style={{ flex: 1, border: "1px solid #e5e7eb", borderRadius: 6, padding: "6px 10px", fontSize: 12, resize: "vertical", outline: "none" }} />
                            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                              <button onClick={() => saveComment(call)} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>OK</button>
                              <button onClick={() => setEditId(null)} style={{ background: "#f3f4f6", color: "#374151", border: "none", borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer" }}>Annuler</button>
                            </div>
                          </div>
                        ) : call.description ? (
                          <div style={{ fontSize: 12, color: "#6b7280", background: "#f9fafb", borderRadius: 6, padding: "6px 10px", marginBottom: 6, cursor: "pointer" }} onClick={() => { setEditId(call.id); setEditComment(call.description ?? ""); }}>
                            💬 {call.description}
                          </div>
                        ) : (
                          <button onClick={() => { setEditId(call.id); setEditComment(""); }} style={{ fontSize: 11, color: "#9ca3af", background: "none", border: "none", cursor: "pointer", padding: 0, marginBottom: 4 }}>
                            + Ajouter un commentaire
                          </button>
                        )}

                        {/* Assignés */}
                        {(assigneeUser || coUsers.length > 0) && (
                          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                            <span style={{ fontSize: 11, color: "#9ca3af" }}>Assigné à :</span>
                            {assigneeUser && <Avatar label={initials(assigneeUser)} color={colorForId(assigneeUser.id)} size={22} />}
                            {coUsers.map(u => <Avatar key={u.id} label={initials(u)} color={colorForId(u.id)} size={22} />)}
                            {assigneeUser && <span style={{ fontSize: 11, color: "#374151" }}>{assigneeUser.prenom} {assigneeUser.nom}{coUsers.length > 0 ? ` +${coUsers.length}` : ""}</span>}
                          </div>
                        )}
                      </div>

                      {/* Statut badge + supprimer */}
                      <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end", flexShrink: 0 }}>
                        <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 5, background: isDone ? "#d1fae5" : "#FEF3C7", color: isDone ? "#059669" : "#D97706" }}>
                          {isDone ? "Traité" : "À traiter"}
                        </span>
                        <button onClick={() => deleteCall(call.id)} style={{ background: "none", border: "none", color: "#d1d5db", cursor: "pointer", fontSize: 14, padding: 2 }} title="Supprimer">✕</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal création appel */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 40, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div ref={formRef} style={{ background: "#fff", borderRadius: 16, width: "min(520px, 95vw)", maxHeight: "90vh", overflowY: "auto", padding: 28, boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#111827" }}>📞 Enregistrer un appel</h2>
              <button onClick={() => setShowForm(false)} style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#9ca3af" }}>✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Field label="Nom de l'appelant">
                <input value={caller} onChange={e => setCaller(e.target.value)} placeholder="Prénom Nom" style={inp} />
              </Field>
              <Field label="Téléphone">
                <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="06 12 34 56 78" type="tel" style={inp} />
              </Field>
              <Field label="Objet de l'appel *">
                <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Demande, raison de l'appel…" style={inp} />
              </Field>
              <Field label="Notes / commentaire">
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Informations complémentaires…" style={{ ...inp, height: "auto", resize: "vertical" }} />
              </Field>
              <Field label="Assigné (principal)">
                <select value={assigneeId} onChange={e => setAssigneeId(e.target.value)} style={inp}>
                  <option value="">— Aucun —</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>)}
                </select>
              </Field>
              <Field label="Co-assignés">
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                  {coIds.map(id => {
                    const u = users.find(x => x.id === id);
                    if (!u) return null;
                    return (
                      <span key={id} style={{ display: "flex", alignItems: "center", gap: 4, background: "#F7F0E6", borderRadius: 20, padding: "2px 10px 2px 6px", fontSize: 12 }}>
                        <Avatar label={initials(u)} color={colorForId(u.id)} size={18} />
                        {u.prenom} {u.nom}
                        <button onClick={() => setCoIds(p => p.filter(x => x !== id))} style={{ background: "none", border: "none", cursor: "pointer", color: "#9ca3af", fontSize: 12, padding: 0, marginLeft: 2 }}>✕</button>
                      </span>
                    );
                  })}
                </div>
                <select value="" onChange={e => { if (e.target.value && !coIds.includes(e.target.value)) setCoIds(p => [...p, e.target.value]); }} style={inp}>
                  <option value="">+ Ajouter une personne…</option>
                  {users.filter(u => u.id !== assigneeId && !coIds.includes(u.id)).map(u => <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>)}
                </select>
              </Field>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "flex-end" }}>
              <button onClick={() => setShowForm(false)} style={{ border: "1px solid #e5e7eb", background: "#fff", color: "#374151", borderRadius: 8, padding: "8px 18px", fontSize: 13, cursor: "pointer" }}>Annuler</button>
              <button onClick={logCall} disabled={saving || (!caller.trim() && !subject.trim())} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: saving ? 0.7 : 1 }}>
                {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const inp: React.CSSProperties = { border: "1px solid #e5e7eb", borderRadius: 8, padding: "8px 12px", fontSize: 13, outline: "none", background: "#f9fafb", width: "100%", boxSizing: "border-box" };

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}
