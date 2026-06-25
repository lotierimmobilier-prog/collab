"use client";
import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { PERF_TYPES } from "@/lib/performance";

const GOLD = "#B8966A"; const GOLD_BG = "#F7F0E6"; const BORDER = "#E6E1D9";

const DAYS   = ["Dimanche","Lundi","Mardi","Mercredi","Jeudi","Vendredi","Samedi"];
const MONTHS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
const MONTHS_SHORT = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];

function todayStr() { const d = new Date(); return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; }
function greet(name: string) { const h = new Date().getHours(); return h < 12 ? `Bonjour ${name}` : h < 18 ? `Bon après-midi ${name}` : `Bonsoir ${name}`; }
function initials(name: string) { const p = name.trim().split(/\s+/); return p.length >= 2 ? (p[0][0]+p[1][0]).toUpperCase() : name.slice(0,2).toUpperCase(); }
function fmtTime(iso: string) { return new Date(iso).toLocaleTimeString("fr-FR",{hour:"2-digit",minute:"2-digit"}); }
function fmtDate(iso: string) { const d = new Date(iso); return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`; }
function isThisWeek(iso: string) { const d = new Date(iso); const now = new Date(); const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - now.getDay() + 1); startOfWeek.setHours(0,0,0,0); const endOfWeek = new Date(startOfWeek); endOfWeek.setDate(startOfWeek.getDate() + 6); endOfWeek.setHours(23,59,59,999); return d >= startOfWeek && d <= endOfWeek; }
function isToday(iso: string) { return new Date(iso).toDateString() === new Date().toDateString(); }

// ─── Types ─────────────────────────────────────────────────────
interface Task { id: string; title: string; status: string; priority: string; dueDate?: string; familyId?: string; family?: { name: string; color: string } }
interface MailThread { id: string; threadId?: string; subject: string; read: boolean; fromEmail: string; fromName: string | null; date: string; accountId: string }
interface CalEvent { id: string; title: string; start: string; end: string; color?: string; location?: string }
interface PhoneCall { id: string; contact: string; phone?: string; direction: string; status: string; subject?: string; notes?: string; createdAt: string }
interface Note { id: string; content: string; color: string; pinned: boolean; updatedAt: string }

const NOTE_COLORS = ["#FFFBEB","#F0FDF4","#EFF6FF","#FEF2F2","#F5F3FF","#fff"];
const PRIORITY_COLOR: Record<string, string> = { urgent: "#DC2626", high: "#D97706", medium: "#2563EB", low: "#9ca3af" };
const CALL_STATUS: Record<string, { label: string; color: string; bg: string }> = {
  to_call:  { label: "À rappeler", color: "#D97706", bg: "#FFFBEB" },
  called:   { label: "Traité",     color: "#059669", bg: "#F0FDF4" },
  missed:   { label: "Manqué",     color: "#DC2626", bg: "#FEF2F2" },
  callback: { label: "Rappel",     color: "#6366F1", bg: "#EEF2FF" },
};

// ─── Rafraîchissement auto à chaque ouverture / focus de la page ──
// Le tableau de bord reste monté lors de la navigation côté client : sans
// ce signal, le planning (et les autres blocs) affichent des données figées.
function useAutoRefresh() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick(t => t + 1);
    const onVisible = () => { if (document.visibilityState === "visible") bump(); };
    window.addEventListener("focus", bump);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("focus", bump);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return tick;
}

// ─── Bloc Tâches ───────────────────────────────────────────────
function TasksBlock({ refreshKey }: { refreshKey: number }) {
  const [tasks, setTasks]   = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTask, setEditTask] = useState<Task | null>(null);

  useEffect(() => {
    fetch("/api/tasks?status=todo,in_progress&limit=15").then(r => r.json()).then(d => setTasks(Array.isArray(d) ? d : d.tasks ?? [])).finally(() => setLoading(false));
  }, [refreshKey]);

  async function done(id: string) {
    await fetch(`/api/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "done" }) });
    setTasks(p => p.filter(t => t.id !== id));
  }

  async function saveEdit(id: string, patch: Partial<Task>) {
    const r = await fetch(`/api/tasks/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    if (r.ok) {
      setTasks(p => p.map(t => t.id === id ? { ...t, ...patch } : t).filter(t => patch.status !== "done" || t.id !== id));
      setEditTask(null);
    }
  }

  const urgent  = tasks.filter(t => t.priority === "urgent" || t.priority === "high");
  const normal  = tasks.filter(t => t.priority !== "urgent" && t.priority !== "high");

  return (
    <Block title="Mes tâches" count={tasks.length} href="/taches" loading={loading} empty={tasks.length === 0} emptyMsg="Aucune tâche en cours">
      {[...urgent, ...normal].slice(0, 8).map(t => (
        <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid #f3f4f6` }}>
          <button onClick={() => done(t.id)} title="Marquer terminée"
            style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${PRIORITY_COLOR[t.priority] ?? "#d1d5db"}`, background: "none", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          </button>
          <div style={{ flex: 1, minWidth: 0, cursor: "pointer" }} onClick={() => setEditTask(t)} title="Modifier la tâche">
            <div style={{ fontSize: 12, fontWeight: 500, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</div>
            {t.dueDate && <div style={{ fontSize: 10, color: isToday(t.dueDate) ? "#DC2626" : "#9ca3af", marginTop: 1 }}>
              {isToday(t.dueDate) ? "Aujourd'hui" : fmtDate(t.dueDate)}
            </div>}
          </div>
          {t.family && <span style={{ fontSize: 10, background: (t.family.color ?? GOLD) + "20", color: t.family.color ?? GOLD, borderRadius: 4, padding: "1px 6px", fontWeight: 600, flexShrink: 0 }}>{t.family.name}</span>}
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: PRIORITY_COLOR[t.priority] ?? "#d1d5db", flexShrink: 0 }} />
        </div>
      ))}
      {editTask && <TaskEditModal task={editTask} onClose={() => setEditTask(null)} onSave={saveEdit} />}
    </Block>
  );
}

function TaskEditModal({ task, onClose, onSave }: { task: Task; onClose: () => void; onSave: (id: string, patch: Partial<Task>) => void }) {
  const [title, setTitle] = useState(task.title);
  const [priority, setPriority] = useState(task.priority);
  const [dueDate, setDueDate] = useState(task.dueDate ? task.dueDate.slice(0, 10) : "");
  const [status, setStatus] = useState(task.status);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 80, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: 420, maxWidth: "94vw", boxShadow: "0 20px 60px rgba(0,0,0,0.25)", overflow: "hidden" }}>
        <div style={{ background: "#1C1A17", padding: "12px 16px", color: "#fff", fontWeight: 600, fontSize: 14, display: "flex", justifyContent: "space-between" }}>
          <span>Modifier la tâche</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#9ca3af", fontSize: 20, cursor: "pointer" }}>×</button>
        </div>
        <div style={{ padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>Titre</label>
            <input value={title} onChange={e => setTitle(e.target.value)} style={editInp} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>Priorité</label>
              <select value={priority} onChange={e => setPriority(e.target.value)} style={editInp}>
                <option value="urgent">Urgente</option><option value="high">Haute</option>
                <option value="medium">Moyenne</option><option value="low">Basse</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>Échéance</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={editInp} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase" }}>Statut</label>
            <select value={status} onChange={e => setStatus(e.target.value)} style={editInp}>
              <option value="todo">À faire</option><option value="in_progress">En cours</option><option value="done">Terminée</option>
            </select>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button onClick={onClose} style={{ background: "#fff", border: "1px solid #E6E1D9", borderRadius: 8, padding: "9px 16px", fontSize: 13, cursor: "pointer" }}>Annuler</button>
            <button onClick={() => onSave(task.id, { title: title.trim(), priority, dueDate: dueDate || undefined, status })} disabled={!title.trim()} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Enregistrer</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const editInp: React.CSSProperties = { width: "100%", height: 36, border: "1px solid #E6E1D9", borderRadius: 8, padding: "0 10px", fontSize: 13, outline: "none", background: "#f9fafb", boxSizing: "border-box", marginTop: 4 };

// ─── Bloc Appels ────────────────────────────────────────────────
function CallsBlock({ refreshKey }: { refreshKey: number }) {
  const [calls, setCalls]   = useState<PhoneCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ contact: "", phone: "", direction: "inbound", subject: "" });

  useEffect(() => { fetch("/api/phone-calls").then(r => r.json()).then(setCalls).finally(() => setLoading(false)); }, [refreshKey]);

  async function add() {
    if (!form.contact) return;
    const res = await fetch("/api/phone-calls", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const saved = await res.json();
    setCalls(p => [saved, ...p]);
    setShowForm(false); setForm({ contact: "", phone: "", direction: "inbound", subject: "" });
  }

  async function markStatus(id: string, status: string) {
    await fetch("/api/phone-calls", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status, calledAt: status === "called" ? new Date().toISOString() : null }) });
    setCalls(p => p.map(c => c.id === id ? { ...c, status } : c));
  }

  async function remove(id: string) {
    await fetch("/api/phone-calls", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setCalls(p => p.filter(c => c.id !== id));
  }

  const pending = calls.filter(c => c.status === "to_call" || c.status === "missed" || c.status === "callback");

  return (
    <Block title="Appels téléphoniques" count={pending.length} href="/appels" loading={loading} empty={calls.length === 0} emptyMsg="Aucun appel enregistré"
      action={<button onClick={() => setShowForm(s => !s)} style={{ fontSize: 11, background: GOLD, color: "#fff", border: "none", borderRadius: 5, padding: "3px 8px", cursor: "pointer" }}>+ Ajouter</button>}>
      {showForm && (
        <div style={{ background: "#FAFAF8", borderRadius: 8, padding: 10, marginBottom: 8, display: "flex", flexDirection: "column", gap: 8 }}>
          <input placeholder="Contact *" value={form.contact} onChange={e => setForm(p => ({ ...p, contact: e.target.value }))} style={inp} />
          <input placeholder="Téléphone" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} style={inp} />
          <input placeholder="Sujet" value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} style={inp} />
          <div style={{ display: "flex", gap: 6 }}>
            <select value={form.direction} onChange={e => setForm(p => ({ ...p, direction: e.target.value }))} style={{ ...inp, flex: 1 }}>
              <option value="inbound">Entrant</option>
              <option value="outbound">Sortant</option>
            </select>
            <button onClick={add} disabled={!form.contact} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 6, padding: "0 12px", fontSize: 12, cursor: "pointer" }}>OK</button>
            <button onClick={() => setShowForm(false)} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 6, padding: "0 10px", fontSize: 12, cursor: "pointer" }}>✕</button>
          </div>
        </div>
      )}
      {pending.slice(0, 6).map(c => {
        const st = CALL_STATUS[c.status] ?? CALL_STATUS.to_call;
        return (
          <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: "1px solid #f3f4f6" }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: c.direction === "inbound" ? "#EFF6FF" : "#F0FDF4", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, flexShrink: 0, color: c.direction === "inbound" ? "#2563EB" : "#059669" }}>
              {c.direction === "inbound" ? "↙" : "↗"}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.contact}</div>
              {c.subject && <div style={{ fontSize: 10, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.subject}</div>}
              {c.phone && <div style={{ fontSize: 10, color: "#9ca3af" }}>{c.phone}</div>}
            </div>
            <span style={{ background: st.bg, color: st.color, borderRadius: 4, padding: "2px 6px", fontSize: 10, fontWeight: 600, flexShrink: 0 }}>{st.label}</span>
            <button onClick={() => markStatus(c.id, "called")} title="Marquer traité" style={{ background: "#F0FDF4", border: "none", borderRadius: 4, width: 24, height: 24, cursor: "pointer", color: "#059669", fontSize: 12, flexShrink: 0 }}>✓</button>
            <button onClick={() => remove(c.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#d1d5db", fontSize: 14, flexShrink: 0 }}>×</button>
          </div>
        );
      })}
      {calls.filter(c => c.status === "called").slice(0, 2).map(c => (
        <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", opacity: 0.5, borderBottom: "1px solid #f3f4f6" }}>
          <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#9ca3af", flexShrink: 0 }}>✓</div>
          <div style={{ fontSize: 12, color: "#9ca3af", textDecoration: "line-through" }}>{c.contact}</div>
        </div>
      ))}
    </Block>
  );
}

// ─── Bloc Mails ─────────────────────────────────────────────────
function MailsBlock({ refreshKey }: { refreshKey: number }) {
  const [threads, setThreads] = useState<MailThread[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/mail/messages?limit=10").then(r => r.json()).then(d => setThreads(Array.isArray(d) ? d : d.messages ?? [])).catch(() => setThreads([])).finally(() => setLoading(false));
  }, [refreshKey]);

  const COLORS = ["#B8966A","#2563EB","#059669","#7C3AED","#DC2626"];
  function avatarColor(s: string) { let h = 0; for (const c of s) h = (h*31+c.charCodeAt(0))%COLORS.length; return COLORS[h]; }

  return (
    <Block title="Derniers mails" count={threads.filter(t => !t.read).length || undefined} href="/messagerie" loading={loading} empty={threads.length === 0} emptyMsg="Aucun mail récent">
      {threads.slice(0, 10).map(t => {
        const name = t.fromName || t.fromEmail || "—";
        const unread = !t.read;
        const target = t.threadId || t.id;
        return (
          <Link key={t.id} href={`/messagerie?mail=${encodeURIComponent(target)}`} style={{ textDecoration: "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 0", borderBottom: "1px solid #f3f4f6", cursor: "pointer" }}
              onMouseEnter={e => (e.currentTarget.style.background = "#fafaf8")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: avatarColor(name), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                {initials(name)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: unread ? 700 : 500, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
                <div style={{ fontSize: 11, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.subject}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3, flexShrink: 0 }}>
                <span style={{ fontSize: 10, color: "#9ca3af" }}>{fmtDate(t.date)}</span>
                {unread && <span style={{ width: 7, height: 7, borderRadius: "50%", background: GOLD, display: "block" }} />}
              </div>
            </div>
          </Link>
        );
      })}
    </Block>
  );
}

// ─── Bloc Agenda ────────────────────────────────────────────────
function AgendaBlock({ refreshKey }: { refreshKey: number }) {
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = new Date();
    const start = new Date(now); start.setDate(now.getDate() - now.getDay() + 1); start.setHours(0,0,0,0);
    const end   = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23,59,59,999);
    fetch(`/api/calendar?from=${start.toISOString()}&to=${end.toISOString()}`).then(r => r.json()).then(d => setEvents(Array.isArray(d) ? d : [])).catch(() => setEvents([])).finally(() => setLoading(false));
  }, [refreshKey]);

  const today = new Date().toDateString();
  const todayEvents = events.filter(e => new Date(e.start).toDateString() === today);
  const otherEvents = events.filter(e => new Date(e.start).toDateString() !== today);

  // Jours de la semaine avec leurs événements
  const weekDays = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay() + 1 + i);
    return { date: d, label: DAYS[d.getDay()].slice(0, 3), num: d.getDate(), isToday: d.toDateString() === today, events: events.filter(e => new Date(e.start).toDateString() === d.toDateString()) };
  });

  return (
    <Block title="Agenda de la semaine" count={events.length || undefined} href="/planning" loading={loading} empty={false} emptyMsg="">
      {/* Mini-calendrier semaine */}
      <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
        {weekDays.map(d => (
          <div key={d.num} style={{ flex: 1, textAlign: "center", padding: "6px 2px", borderRadius: 8, background: d.isToday ? GOLD : "#f9fafb", border: `1px solid ${d.isToday ? GOLD : BORDER}` }}>
            <div style={{ fontSize: 9, fontWeight: 600, color: d.isToday ? "#fff" : "#9ca3af", textTransform: "uppercase" }}>{d.label}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: d.isToday ? "#fff" : "#374151" }}>{d.num}</div>
            {d.events.length > 0 && <div style={{ width: 5, height: 5, borderRadius: "50%", background: d.isToday ? "rgba(255,255,255,0.7)" : GOLD, margin: "2px auto 0" }} />}
          </div>
        ))}
      </div>

      {events.length === 0 && <div style={{ textAlign: "center", color: "#9ca3af", fontSize: 12, padding: "16px 0" }}>Aucun événement cette semaine</div>}

      {todayEvents.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: GOLD, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Aujourd'hui</div>
          {todayEvents.map(e => <EventRow key={e.id} event={e} highlight />)}
        </div>
      )}
      {otherEvents.slice(0, 4).map(e => <EventRow key={e.id} event={e} />)}

      <Link href="/planning" style={{ display: "block", textAlign: "center", marginTop: 8, fontSize: 11, color: GOLD, textDecoration: "none", fontWeight: 600 }}>Voir tout le planning →</Link>
    </Block>
  );
}

function EventRow({ event, highlight }: { event: CalEvent; highlight?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 8, padding: "7px 0", borderBottom: "1px solid #f3f4f6", alignItems: "flex-start" }}>
      <div style={{ width: 3, borderRadius: 2, alignSelf: "stretch", background: event.color ?? GOLD, flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: highlight ? 700 : 500, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{event.title}</div>
        <div style={{ fontSize: 10, color: "#6b7280", marginTop: 1 }}>
          {!isToday(event.start) && <span style={{ marginRight: 6 }}>{DAYS[new Date(event.start).getDay()].slice(0,3)} {fmtDate(event.start)}</span>}
          {fmtTime(event.start)} – {fmtTime(event.end)}
          {event.location && <span style={{ marginLeft: 6 }}>· {event.location}</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Bloc Notes ─────────────────────────────────────────────────
function NotesBlock({ refreshKey }: { refreshKey: number }) {
  const [notes, setNotes]   = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<string | null>(null);
  const [draft, setDraft]   = useState("");
  const [addColor, setAddColor] = useState(NOTE_COLORS[0]);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { fetch("/api/notes").then(r => r.json()).then(setNotes).finally(() => setLoading(false)); }, [refreshKey]);

  async function addNote() {
    if (!draft.trim()) return;
    const res = await fetch("/api/notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: draft, color: addColor }) });
    const saved = await res.json();
    setNotes(p => [saved, ...p]);
    setDraft(""); setActive(null);
  }

  async function updateNote(id: string, content: string) {
    await fetch("/api/notes", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, content }) });
    setNotes(p => p.map(n => n.id === id ? { ...n, content } : n));
  }

  async function deleteNote(id: string) {
    await fetch("/api/notes", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setNotes(p => p.filter(n => n.id !== id));
    setActive(null);
  }

  async function togglePin(id: string, pinned: boolean) {
    await fetch("/api/notes", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, pinned: !pinned }) });
    setNotes(p => p.map(n => n.id === id ? { ...n, pinned: !pinned } : n).sort((a, b) => +b.pinned - +a.pinned));
  }

  return (
    <Block title="Notes personnelles" count={notes.length || undefined} href="#" loading={loading} empty={false} emptyMsg="">
      {/* Zone de création */}
      {active === "new" ? (
        <div style={{ background: addColor, borderRadius: 10, padding: 10, marginBottom: 10, border: `1px solid ${BORDER}` }}>
          <textarea ref={textRef} autoFocus value={draft} onChange={e => setDraft(e.target.value)} placeholder="Écrire une note…"
            style={{ width: "100%", border: "none", background: "transparent", resize: "none", fontSize: 12, outline: "none", minHeight: 64, fontFamily: "inherit", boxSizing: "border-box" }} />
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6 }}>
            {NOTE_COLORS.map(c => <button key={c} onClick={() => setAddColor(c)} style={{ width: 16, height: 16, borderRadius: "50%", background: c, border: addColor === c ? `2px solid ${GOLD}` : `1px solid ${BORDER}`, cursor: "pointer", padding: 0 }} />)}
            <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              <button onClick={() => { setActive(null); setDraft(""); }} style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 5, padding: "3px 8px", fontSize: 11, cursor: "pointer" }}>Annuler</button>
              <button onClick={addNote} disabled={!draft.trim()} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 5, padding: "3px 10px", fontSize: 11, cursor: "pointer" }}>Sauvegarder</button>
            </div>
          </div>
        </div>
      ) : (
        <button onClick={() => setActive("new")} style={{ width: "100%", background: "#FAFAF8", border: `1px dashed ${BORDER}`, borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#9ca3af", cursor: "pointer", textAlign: "left", marginBottom: 10 }}>
          + Nouvelle note…
        </button>
      )}

      {notes.length === 0 && active !== "new" && <div style={{ textAlign: "center", color: "#9ca3af", fontSize: 12, padding: "16px 0" }}>Aucune note</div>}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {notes.map(n => (
          <div key={n.id} style={{ background: n.color, borderRadius: 10, padding: "10px 12px", border: `1px solid ${BORDER}`, position: "relative" }}>
            {active === n.id ? (
              <textarea defaultValue={n.content} autoFocus onBlur={e => { updateNote(n.id, e.target.value); setActive(null); }}
                style={{ width: "100%", border: "none", background: "transparent", resize: "none", fontSize: 12, outline: "none", minHeight: 48, fontFamily: "inherit", boxSizing: "border-box" }} />
            ) : (
              <div onClick={() => setActive(n.id)} style={{ fontSize: 12, color: "#374151", whiteSpace: "pre-wrap", wordBreak: "break-word", cursor: "text", minHeight: 20, lineHeight: 1.5 }}>{n.content}</div>
            )}
            <div style={{ display: "flex", gap: 4, marginTop: 6, justifyContent: "flex-end" }}>
              <button onClick={() => togglePin(n.id, n.pinned)} title={n.pinned ? "Désépingler" : "Épingler"} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 12, opacity: n.pinned ? 1 : 0.4, padding: "1px 3px" }}>📌</button>
              <button onClick={() => deleteNote(n.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 11, color: "#9ca3af", padding: "1px 3px" }}>×</button>
            </div>
          </div>
        ))}
      </div>
    </Block>
  );
}

// ─── Bloc Classement du trimestre ───────────────────────────────
interface RankRow { userId: string; name: string; roleId: string | null; counts: Record<string, number>; amount: number; total: number }

function RankingBlock({ refreshKey, currentUserId }: { refreshKey: number; currentUserId?: string }) {
  const [data, setData]     = useState<{ quarterLabel: string; ranking: RankRow[]; totals: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/performance/ranking").then(r => r.json())
      .then(d => setData(d?.ranking ? d : { quarterLabel: "", ranking: [], totals: {} }))
      .catch(() => setData({ quarterLabel: "", ranking: [], totals: {} }))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const ranking = data?.ranking ?? [];
  const totals  = data?.totals ?? {};
  const medal = (i: number) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`);

  return (
    <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${BORDER}`, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", overflow: "hidden" }}>
      <div style={{ padding: "14px 16px 10px", borderBottom: `1px solid #f3f4f6`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>🏆 Classement du trimestre</span>
          {data?.quarterLabel && <span style={{ background: GOLD_BG, color: GOLD, borderRadius: 8, padding: "1px 8px", fontSize: 10, fontWeight: 700 }}>{data.quarterLabel}</span>}
        </div>
      </div>
      <div style={{ padding: "10px 16px 14px" }}>
        {loading && <div style={{ padding: "16px 0", textAlign: "center", color: "#9ca3af", fontSize: 12 }}>Chargement…</div>}
        {!loading && ranking.length === 0 && (
          <div style={{ padding: "16px 0", textAlign: "center", color: "#9ca3af", fontSize: 12 }}>Aucune opération enregistrée ce trimestre.</div>
        )}
        {!loading && ranking.length > 0 && (
          <>
            {/* En-tête colonnes */}
            <div style={{ display: "grid", gridTemplateColumns: "28px 1fr repeat(4, 38px) 42px", gap: 4, alignItems: "center", padding: "0 4px 6px", fontSize: 9, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase" }}>
              <span></span><span></span>
              {PERF_TYPES.map(t => <span key={t.id} title={t.label} style={{ textAlign: "center" }}>{t.icon}</span>)}
              <span style={{ textAlign: "center" }}>Tot.</span>
            </div>
            {ranking.slice(0, 8).map((r, i) => {
              const isMe = r.userId === currentUserId;
              return (
                <div key={r.userId} style={{ display: "grid", gridTemplateColumns: "28px 1fr repeat(4, 38px) 42px", gap: 4, alignItems: "center", padding: "6px 4px", borderTop: i === 0 ? "none" : "1px solid #f6f6f4", background: isMe ? GOLD_BG : "transparent", borderRadius: 6 }}>
                  <span style={{ fontSize: 13, textAlign: "center" }}>{medal(i)}</span>
                  <span style={{ fontSize: 12, fontWeight: isMe ? 700 : 500, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.name}{isMe && <span style={{ color: GOLD, fontWeight: 700 }}> · vous</span>}
                  </span>
                  {PERF_TYPES.map(t => (
                    <span key={t.id} style={{ textAlign: "center", fontSize: 12, color: r.counts[t.id] ? t.color : "#d1d5db", fontWeight: r.counts[t.id] ? 700 : 400 }}>
                      {r.counts[t.id] ?? 0}
                    </span>
                  ))}
                  <span style={{ textAlign: "center", fontSize: 13, fontWeight: 700, color: GOLD }}>{r.total}</span>
                </div>
              );
            })}
            {/* Total agence */}
            <div style={{ display: "grid", gridTemplateColumns: "28px 1fr repeat(4, 38px) 42px", gap: 4, alignItems: "center", padding: "8px 4px 2px", marginTop: 4, borderTop: "2px solid #f3f4f6", fontSize: 11, fontWeight: 700, color: "#6b7280" }}>
              <span></span><span style={{ textTransform: "uppercase", fontSize: 10 }}>Total agence</span>
              {PERF_TYPES.map(t => <span key={t.id} style={{ textAlign: "center", color: t.color }}>{totals[t.id] ?? 0}</span>)}
              <span style={{ textAlign: "center", color: GOLD }}>{PERF_TYPES.reduce((s, t) => s + (totals[t.id] ?? 0), 0)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Conteneur générique ────────────────────────────────────────
function Block({ title, count, href, loading, empty, emptyMsg, children, action }: {
  title: string; count?: number; href: string; loading: boolean; empty: boolean; emptyMsg: string; children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${BORDER}`, display: "flex", flexDirection: "column", boxShadow: "0 1px 4px rgba(0,0,0,0.05)", overflow: "hidden" }}>
      <div style={{ padding: "14px 16px 10px", borderBottom: `1px solid #f3f4f6`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{title}</span>
          {count !== undefined && count > 0 && <span style={{ background: GOLD, color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 10, fontWeight: 700 }}>{count}</span>}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {action}
          {href !== "#" && <Link href={href} style={{ fontSize: 11, color: GOLD, textDecoration: "none", fontWeight: 600 }}>Voir tout →</Link>}
        </div>
      </div>
      <div style={{ padding: "4px 16px 12px", flex: 1, overflowY: "auto", maxHeight: 340 }}>
        {loading && <div style={{ padding: "20px 0", textAlign: "center", color: "#9ca3af", fontSize: 12 }}>Chargement…</div>}
        {!loading && empty && <div style={{ padding: "20px 0", textAlign: "center", color: "#9ca3af", fontSize: 12 }}>{emptyMsg}</div>}
        {!loading && children}
      </div>
    </div>
  );
}

const inp: React.CSSProperties = { height: 32, border: `1px solid ${BORDER}`, borderRadius: 6, padding: "0 8px", fontSize: 12, outline: "none", background: "#fff", width: "100%", boxSizing: "border-box" };

// ─── Dashboard principal ────────────────────────────────────────
export default function Dashboard() {
  const { data: session } = useSession();
  const firstName = (session?.user as { prenom?: string })?.prenom ?? session?.user?.name?.split(" ")[0] ?? "vous";
  const currentUserId = (session?.user as { id?: string })?.id;
  const refreshKey = useAutoRefresh();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Bannière */}
      <div style={{ background: `linear-gradient(135deg, ${GOLD} 0%, #8A6A42 100%)`, borderRadius: 14, padding: "20px 26px", color: "#fff", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontSize: 19, fontWeight: 700 }}>{greet(firstName)}</div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>{todayStr()}</div>
        </div>
        <div style={{ fontSize: 42, opacity: 0.15 }}>◈</div>
      </div>

      {/* Classement du trimestre — pleine largeur */}
      <div style={{ marginBottom: 16 }}>
        <RankingBlock refreshKey={refreshKey} currentUserId={currentUserId} />
      </div>

      {/* Grille 2×2 */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <TasksBlock refreshKey={refreshKey} />
        <CallsBlock refreshKey={refreshKey} />
        <MailsBlock refreshKey={refreshKey} />
        <AgendaBlock refreshKey={refreshKey} />
      </div>

      {/* Notes — pleine largeur en bas */}
      <div style={{ marginTop: 16 }}>
        <NotesBlock refreshKey={refreshKey} />
      </div>
    </div>
  );
}
