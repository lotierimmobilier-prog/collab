"use client";
import { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";

const GOLD = "#B8966A"; const GOLD_BG = "#F7F0E6"; const BORDER = "#E6E1D9"; const DARK = "#1C1A17"; const RED = "#DC2626";

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
interface CalEvent { id: string; title: string; start: string; end: string; color?: string; location?: string; source?: string; allDay?: boolean }
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
  const [allEvents, setAllEvents] = useState<CalEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // On récupère TOUT l'agenda (comme la page Planning) puis on filtre la semaine
  // côté client : le tableau de bord affiche exactement les mêmes événements.
  useEffect(() => {
    let alive = true;
    const load = () => fetch(`/api/calendar`).then(r => r.json()).then(d => { if (alive) setAllEvents(Array.isArray(d) ? d : []); }).catch(() => { if (alive) setAllEvents([]); }).finally(() => { if (alive) setLoading(false); });
    load();
    // Affichage « temps réel » : rafraîchit l'agenda (dont Google) toutes les 2 min.
    const t = setInterval(load, 120_000);
    return () => { alive = false; clearInterval(t); };
  }, [refreshKey]);

  const now = new Date();
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay() + 1); weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6); weekEnd.setHours(23, 59, 59, 999);
  // Chevauchement : un événement compte s'il recoupe la semaine.
  const events = allEvents.filter(e => new Date(e.start) <= weekEnd && new Date(e.end ?? e.start) >= weekStart);

  const today = new Date().toDateString();
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);

  // Jours de la semaine (bandeau) avec le nombre d'événements.
  const weekDays = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - d.getDay() + 1 + i);
    return { date: d, label: DAYS[d.getDay()].slice(0, 3), num: d.getDate(), isToday: d.toDateString() === today, count: events.filter(e => new Date(e.start).toDateString() === d.toDateString()).length };
  });

  // Événements à venir (d'aujourd'hui jusqu'à la fin de semaine), triés et
  // regroupés par jour pour une lecture claire.
  const upcoming = events
    .filter(e => new Date(e.end ?? e.start) >= startOfToday)
    .sort((a, b) => +new Date(a.start) - +new Date(b.start));
  const groups: { key: string; date: Date; events: CalEvent[] }[] = [];
  for (const e of upcoming) {
    const k = new Date(e.start).toDateString();
    let g = groups.find(x => x.key === k);
    if (!g) { g = { key: k, date: new Date(e.start), events: [] }; groups.push(g); }
    g.events.push(e);
  }

  // On limite l'affichage à ~7 lignes, le reste renvoie au planning.
  const MAX = 7;
  let shown = 0;
  const visibleGroups = groups.map(g => {
    if (shown >= MAX) return null;
    const slice = g.events.slice(0, MAX - shown);
    shown += slice.length;
    return { ...g, events: slice };
  }).filter(Boolean) as typeof groups;
  const hiddenCount = upcoming.length - shown;

  return (
    <Block title="Agenda de la semaine" count={events.length || undefined} href="/planning" loading={loading} empty={false} emptyMsg="">
      {/* Bandeau des jours de la semaine */}
      <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
        {weekDays.map(d => (
          <div key={d.num} style={{ flex: 1, textAlign: "center", padding: "7px 2px", borderRadius: 9, background: d.isToday ? GOLD : "#f9fafb", border: `1px solid ${d.isToday ? GOLD : BORDER}` }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: d.isToday ? "#fff" : "#9ca3af", textTransform: "uppercase", letterSpacing: "0.03em" }}>{d.label}</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: d.isToday ? "#fff" : "#374151" }}>{d.num}</div>
            <div style={{ height: 16, marginTop: 2 }}>
              {d.count > 0 && (
                <span style={{ display: "inline-block", minWidth: 16, fontSize: 9.5, fontWeight: 700, lineHeight: "15px", borderRadius: 8, padding: "0 4px", background: d.isToday ? "rgba(255,255,255,0.25)" : GOLD_BG, color: d.isToday ? "#fff" : GOLD }}>{d.count}</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {upcoming.length === 0 ? (
        <div style={{ textAlign: "center", color: "#9ca3af", fontSize: 12, padding: "20px 0" }}>Aucun rendez-vous à venir cette semaine</div>
      ) : (
        visibleGroups.map(g => (
          <div key={g.key} style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: GOLD, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{dayHeading(g.date)}</div>
            {g.events.map(e => <EventRow key={e.id} event={e} />)}
          </div>
        ))
      )}

      {hiddenCount > 0 && (
        <div style={{ fontSize: 11, color: "#9ca3af", textAlign: "center", marginTop: 2 }}>+ {hiddenCount} autre{hiddenCount > 1 ? "s" : ""} rendez-vous</div>
      )}

      <Link href="/planning" style={{ display: "block", textAlign: "center", marginTop: 8, fontSize: 11, color: GOLD, textDecoration: "none", fontWeight: 600 }}>Voir tout le planning →</Link>
    </Block>
  );
}

// En-tête de groupe de jour : « Aujourd'hui », « Demain » ou « Mardi 23 ».
function dayHeading(d: Date): string {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const dd = new Date(d); dd.setHours(0, 0, 0, 0);
  const diff = Math.round((+dd - +t) / 86_400_000);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return "Demain";
  return `${DAYS[dd.getDay()]} ${dd.getDate()}`;
}

function EventRow({ event }: { event: CalEvent }) {
  const allDay = event.allDay || !event.start.includes("T");
  const color = event.color ?? GOLD;
  return (
    <div style={{ display: "flex", gap: 9, padding: "7px 0", borderBottom: "1px solid #f3f4f6", alignItems: "stretch" }}>
      <div style={{ width: 3, borderRadius: 2, background: color, flexShrink: 0 }} />
      <div style={{ width: 44, flexShrink: 0 }}>
        {allDay ? (
          <div style={{ fontSize: 10, fontWeight: 700, color: GOLD }}>Journée</div>
        ) : (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#111827" }}>{fmtTime(event.start)}</div>
            <div style={{ fontSize: 10, color: "#9ca3af" }}>{fmtTime(event.end)}</div>
          </>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{event.title}</div>
        {event.location && <div style={{ fontSize: 10.5, color: "#6b7280", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>📍 {event.location}</div>}
      </div>
      {event.source === "google" && (
        <span style={{ alignSelf: "center", fontSize: 9, fontWeight: 700, color: "#4285F4", background: "rgba(66,133,244,0.08)", borderRadius: 4, padding: "1px 5px", flexShrink: 0 }}>Google</span>
      )}
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
// Mandats signés par négociateur, synchronisés depuis Protexa (T / G).
// Réservé à la direction : l'API renvoie 403 sinon → le bloc s'auto-masque.
// Podium « fun » des négociateurs : top 3 mandats transaction + top 3 gestion,
// par trimestre ou année. Visible par tous (leaderboard motivant).
function PodiumBlock({ refreshKey }: { refreshKey: number }) {
  type Row = { negociateur: string; transaction: number; gestion: number; t: number[]; g: number[] };
  const [d, setD] = useState<{ negociateurs: Row[]; syncedAt: string | null } | null>(null);
  const [period, setPeriod] = useState<"year" | 0 | 1 | 2 | 3>("year");
  // On ne remplace les données que si la réponse est exploitable : un
  // rafraîchissement qui échoue ne doit pas faire disparaître le bloc.
  useEffect(() => { fetch("/api/protexa/podium").then(r => r.ok ? r.json() : null).then(x => { if (x?.negociateurs?.length) setD(x); }).catch(() => {}); }, [refreshKey]);
  if (!d || !d.negociateurs?.length) return null;

  const year = d.syncedAt ? new Date(d.syncedAt).getFullYear() : new Date().getFullYear();
  const trimMonths = ["janv.–mars", "avr.–juin", "juil.–sept.", "oct.–déc."];
  const periodLabel = period === "year" ? `Année ${year}` : `${period + 1}ᵉ trimestre ${year} · ${trimMonths[period]}`;
  const top3 = (key: "t" | "g", tot: "transaction" | "gestion") => d.negociateurs
    .map(r => ({ name: r.negociateur, value: period === "year" ? r[tot] : (r[key][period] ?? 0) }))
    .filter(x => x.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);
  // Classement général (tous les agents) pour la colonne de droite.
  const ranking = d.negociateurs.map(r => {
    const tx = period === "year" ? r.transaction : (r.t[period] ?? 0);
    const ge = period === "year" ? r.gestion : (r.g[period] ?? 0);
    return { name: r.negociateur, tx, ge, total: tx + ge };
  }).filter(x => x.total > 0).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  const TabBtn = ({ id, label }: { id: "year" | 0 | 1 | 2 | 3; label: string }) => (
    <button onClick={() => setPeriod(id)} style={{
      background: period === id ? GOLD : "#fff", color: period === id ? "#fff" : "#6b7280",
      border: `1px solid ${period === id ? GOLD : BORDER}`, borderRadius: 7, padding: "3px 9px",
      fontSize: 10.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
    }}>{label}</button>
  );

  return (
    <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${BORDER}`, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", overflow: "hidden", marginBottom: 16 }}>
      <div style={{ padding: "13px 16px 9px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 9, flexWrap: "wrap" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>🏆 Podium des mandats</span>
          <span style={{ fontSize: 10, fontWeight: 700, color: GOLD, background: GOLD_BG, borderRadius: 8, padding: "1px 8px" }}>{periodLabel}</span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <TabBtn id="year" label="Année" /><TabBtn id={0} label="1T" /><TabBtn id={1} label="2T" /><TabBtn id={2} label="3T" /><TabBtn id={3} label="4T" />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", alignItems: "stretch" }}>
        {/* Colonne gauche : podiums empilés (Transaction puis Gestion) */}
        <div style={{ borderRight: "1px solid #f0e8d8" }}>
          <Podium icon="🤝" title="Transaction" rows={top3("t", "transaction")} />
          <div style={{ borderTop: "1px dashed #ece1cd", margin: "0 14px" }} />
          <Podium icon="🏠" title="Gestion" rows={top3("g", "gestion")} />
        </div>
        {/* Colonne droite : classement général */}
        <RankingList rows={ranking} />
      </div>
    </div>
  );
}

// Classement général de tous les négociateurs (colonne droite du podium).
function RankingList({ rows }: { rows: { name: string; tx: number; ge: number; total: number }[] }) {
  const medal = (i: number) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}`);
  const cell: React.CSSProperties = { padding: "5px 8px", fontSize: 12, textAlign: "right", whiteSpace: "nowrap" };
  const head: React.CSSProperties = { ...cell, fontSize: 9.5, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.3 };
  return (
    <div style={{ padding: "8px 14px 14px" }}>
      <div style={{ textAlign: "center", fontSize: 13, fontWeight: 800, color: DARK, marginBottom: 6 }}>📊 Classement général</div>
      {!rows.length ? (
        <div style={{ textAlign: "center", color: "#b9b2a6", fontSize: 12, padding: "30px 0" }}>Aucun mandat sur la période 🤷</div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ ...head, width: 26, textAlign: "center" }}>#</th>
              <th style={{ ...head, textAlign: "left" }}>Négociateur</th>
              <th style={head}>T</th>
              <th style={head}>G</th>
              <th style={{ ...head, color: GOLD }}>Tot.</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.name} style={{ borderTop: "1px solid #f6f1e8", background: i < 3 ? "#fffaf0" : "transparent" }}>
                <td style={{ ...cell, textAlign: "center", fontWeight: 700, fontSize: i < 3 ? 14 : 11, color: "#6b7280" }}>{medal(i)}</td>
                <td style={{ ...cell, textAlign: "left", fontWeight: i < 3 ? 700 : 600, color: "#111827" }}>{r.name}</td>
                <td style={cell}>{r.tx}</td>
                <td style={cell}>{r.ge}</td>
                <td style={{ ...cell, fontWeight: 800, color: GOLD }}>{r.total}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Podium({ title, icon, rows }: { title: string; icon: string; rows: { name: string; value: number }[] }) {
  // Palette feutrée [2e argent · 1er or agence · 3e bronze]
  const palette = [
    { ring: "#CBD0D8", step: "#EEF1F4", txt: "#6B7280" },
    { ring: GOLD,      step: GOLD_BG,   txt: GOLD },
    { ring: "#CDB79E", step: "#F2EBE0", txt: "#9C7A55" },
  ];
  const slots = [rows[1], rows[0], rows[2]];
  const heights = [38, 54, 28];
  const medals = ["🥈", "🥇", "🥉"];
  const ranks = ["2", "1", "3"];
  const initials = (n: string) => n.split(/\s+/).filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div style={{ padding: "6px 14px 12px" }}>
      <div style={{ textAlign: "center", fontSize: 11.5, fontWeight: 700, color: "#6b7280", marginBottom: 4 }}>{icon} {title}</div>
      {!rows.length ? (
        <div style={{ textAlign: "center", color: "#9ca3af", fontSize: 11.5, padding: "18px 0" }}>Aucun mandat sur la période.</div>
      ) : (
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "center", gap: 10 }}>
          {slots.map((r, i) => {
            if (!r) return <div key={i} style={{ flex: 1, maxWidth: 84 }} />;
            const p = palette[i], first = i === 1;
            return (
              <div key={i} style={{ flex: 1, maxWidth: 84, display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ position: "relative", width: first ? 38 : 32, height: first ? 38 : 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: p.txt, fontWeight: 700, fontSize: first ? 12.5 : 10.5, background: p.step, border: `2px solid ${p.ring}` }}>
                  {initials(r.name)}
                  <span style={{ position: "absolute", bottom: -5, right: -6, fontSize: 13 }}>{medals[i]}</span>
                </div>
                <div style={{ fontSize: 10.5, fontWeight: 600, color: "#111827", textAlign: "center", marginTop: 4, lineHeight: 1.1, minHeight: 24 }}>{r.name}</div>
                <div style={{ fontSize: first ? 16 : 14, fontWeight: 800, color: p.txt, lineHeight: 1, marginBottom: 3 }}>{r.value}</div>
                <div style={{ width: "100%", height: heights[i], borderRadius: "6px 6px 0 0", background: p.step, border: `1px solid ${p.ring}`, borderBottom: "none", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: 3, color: p.txt, fontWeight: 700, fontSize: 13 }}>
                  {ranks[i]}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Carte super admin : déclenche la synchronisation Protexa (le robot tourne sur
// le VPS ; ce bouton pose une demande que le poller du VPS exécute).
function ProtexaSyncBlock() {
  const [info, setInfo] = useState<{ lastSync: string | null; pending: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = () => fetch("/api/protexa/run").then(r => r.ok ? r.json() : null).then(d => { if (d) setInfo({ lastSync: d.lastSync, pending: d.pending }); }).catch(() => {});
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!info?.pending) return;
    const t = setInterval(load, 12000);
    return () => clearInterval(t);
  }, [info?.pending]);

  const launch = async () => {
    setBusy(true); setMsg("");
    const r = await fetch("/api/protexa/run", { method: "POST" }).then(x => x.json()).catch(() => null);
    setBusy(false);
    if (r?.ok) { setMsg("✅ Demande envoyée — le robot lance la synchronisation dans la minute. La page se met à jour automatiquement."); load(); }
    else setMsg("⚠️ " + (r?.error || "Échec de la demande."));
  };

  const fmt = (s: string | null) => s ? new Date(s).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" }) : "jamais";
  const disabled = busy || !!info?.pending;

  return (
    <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16, marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: DARK }}>📊 Synchronisation Protexa</div>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 3 }}>
            Dernière synchro : <b>{fmt(info?.lastSync ?? null)}</b>{info?.pending ? " · ⏳ en cours…" : ""}
          </div>
        </div>
        <button onClick={launch} disabled={disabled} style={{ background: disabled ? "#d1d5db" : GOLD, color: "#fff", border: "none", borderRadius: 10, padding: "10px 16px", fontSize: 13, fontWeight: 700, cursor: disabled ? "default" : "pointer" }}>
          {info?.pending ? "Synchronisation demandée…" : busy ? "Envoi…" : "🔄 Lancer la synchronisation"}
        </button>
      </div>
      {msg && <div style={{ fontSize: 12.5, color: "#374151", marginTop: 10 }}>{msg}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { data: session } = useSession();
  const firstName = (session?.user as { prenom?: string })?.prenom ?? session?.user?.name?.split(" ")[0] ?? "vous";
  const superAdmin = (session?.user as { superAdmin?: boolean })?.superAdmin === true;
  const refreshKey = useAutoRefresh();

  const [dash, setDash] = useState<{ kpis: { id?: string; label: string; value: string; sub?: string }[]; blocks: string[] } | null>(null);
  const [showCustom, setShowCustom] = useState(false);
  const [dragBlock, setDragBlock] = useState<string | null>(null);
  const loadDash = () => fetch("/api/dashboard/stats").then(r => r.ok ? r.json() : null).then(d => { if (d) setDash(d); }).catch(() => {});
  useEffect(() => { loadDash(); }, [refreshKey]);

  // Migration douce : l'ancien bloc « ranking » devient « podium ».
  // Le podium est affiché en permanence en tête (hors système de blocs).
  const rawBlocks = dash?.blocks ?? ["mails", "tasks", "agenda", "calls", "notes"];
  const blocks = [...new Set(rawBlocks)].filter(b => b !== "ranking" && b !== "podium");

  // Réordonnancement (glisser-déposer) — persistance des préférences.
  const reorder = (list: string[], from: string, to: string) => {
    const a = [...list]; const fi = a.indexOf(from), ti = a.indexOf(to);
    if (fi < 0 || ti < 0 || fi === ti) return a;
    a.splice(ti, 0, a.splice(fi, 1)[0]); return a;
  };
  const saveBlocks = (next: string[]) => {
    setDash(d => d ? { ...d, blocks: next } : d);
    fetch("/api/me/dashboard-prefs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ blocks: next }) }).catch(() => {});
  };
  const reorderKpis = (ids: string[]) => {
    setDash(d => d ? { ...d, kpis: ids.map(id => d.kpis.find(k => k.id === id)).filter(Boolean) as typeof d.kpis } : d);
    fetch("/api/me/dashboard-prefs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kpis: ids }) }).catch(() => {});
  };

  // Rendu d'un bloc selon son identifiant.
  const FULL_WIDTH = new Set(["notes"]);
  const nodeFor = (id: string) => {
    switch (id) {
      case "mails":   return <MailsBlock refreshKey={refreshKey} />;
      case "tasks":   return <TasksBlock refreshKey={refreshKey} />;
      case "agenda":  return <AgendaBlock refreshKey={refreshKey} />;
      case "calls":   return <CallsBlock refreshKey={refreshKey} />;
      case "notes":   return <NotesBlock refreshKey={refreshKey} />;
      default: return null;
    }
  };
  const ordered = blocks.filter(id => nodeFor(id) !== null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {/* Bannière d'accueil — citation + météo + indicateurs (réordonnables) */}
      <Banner firstName={firstName} kpis={dash?.kpis ?? []} onCustomize={() => setShowCustom(true)} onReorderKpis={reorderKpis} />

      {/* Podium des mandats + classement général (top 3 + tous les agents) — visible par tous */}
      <PodiumBlock refreshKey={refreshKey} />

      {/* Synchronisation Protexa — réservé au super administrateur */}
      {superAdmin && <ProtexaSyncBlock />}

      {/* Blocs du tableau de bord — dans l'ordre choisi, déplaçables par la poignée ⠿ */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, alignItems: "start" }}>
        {ordered.map(id => (
          <div key={id}
            onDragOver={e => { if (dragBlock) e.preventDefault(); }}
            onDrop={e => { e.preventDefault(); if (dragBlock && dragBlock !== id) saveBlocks(reorder(ordered, dragBlock, id)); setDragBlock(null); }}
            style={{ gridColumn: FULL_WIDTH.has(id) ? "1 / -1" : "auto", position: "relative",
              outline: dragBlock && dragBlock !== id ? `2px dashed ${GOLD}` : "none", outlineOffset: 2, borderRadius: 14,
              opacity: dragBlock === id ? 0.5 : 1, transition: "opacity 0.15s" }}>
            {/* Poignée ronde flottante dans le coin haut-gauche (hors de la zone
                des contrôles des blocs, ex. le bouton « Nombre » du classement). */}
            <span
              draggable
              onDragStart={() => setDragBlock(id)}
              onDragEnd={() => setDragBlock(null)}
              title="Glisser pour déplacer ce cadre"
              style={{ position: "absolute", top: -9, left: -9, zIndex: 6, cursor: "grab",
                width: 26, height: 26, borderRadius: "50%", background: GOLD, color: "#fff", border: "2px solid #fff",
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700,
                lineHeight: 1, userSelect: "none", boxShadow: "0 2px 6px rgba(0,0,0,0.22)" }}>⠿</span>
            {nodeFor(id)}
          </div>
        ))}
      </div>

      {showCustom && <CustomizePanel onClose={() => setShowCustom(false)} onSaved={() => { setShowCustom(false); loadDash(); }} />}
    </div>
  );
}

// ─── Budget Auguste (super admin) — intégré dans la bannière ─────────
interface AugAgent { userId: string; userName: string; total: number; cost: number }
interface AugUsage { month: string; cap: number; totalTokens: number; totalCost: number; agents: AugAgent[]; real: { amountUsd: number } | null }
export const fmtTok = (n: number) => n >= 1e6 ? `${(n / 1e6).toFixed(2)} M` : n >= 1e3 ? `${(n / 1e3).toFixed(0)} k` : String(n);
const usd = (n: number) => `$${n.toFixed(2)}`;
function AugusteBudgetBanner() {
  const [d, setD] = useState<AugUsage | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => { fetch("/api/admin/auguste-usage").then(r => r.ok ? r.json() : null).then(setD).catch(() => {}); }, []);
  if (!d) return null; // non super admin → endpoint 403 → masqué
  const pill = (label: string, value: string, color: string) => (
    <span style={{ display: "inline-flex", alignItems: "baseline", gap: 5, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 999, padding: "5px 12px" }}>
      <span style={{ fontSize: 10, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.03em" }}>{label}</span>
      <span style={{ fontSize: 13.5, fontWeight: 800, color }}>{value}</span>
    </span>
  );
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: GOLD }}>✦ Budget Auguste</span>
        {pill("API estimé", usd(d.totalCost), DARK)}
        {pill("API réel", d.real ? usd(d.real.amountUsd) : "—", d.real ? "#2F855A" : "#9ca3af")}
        {pill("Tokens", `${fmtTok(d.totalTokens)} / ${fmtTok(d.cap)}·agent`, GOLD)}
        <button onClick={() => setOpen(o => !o)} style={{ background: "none", border: "none", color: GOLD, fontSize: 11.5, cursor: "pointer", textDecoration: "underline" }}>{open ? "masquer" : "détail par agent"}</button>
      </div>
      {open && (
        <div style={{ marginTop: 8, background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, padding: 10 }}>
          {d.agents.length === 0 ? <div style={{ fontSize: 12, color: "#9ca3af" }}>Aucune consommation ce mois.</div> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {d.agents.map(a => {
                const pct = d.cap > 0 ? Math.min(100, Math.round((a.total / d.cap) * 100)) : 0;
                return (
                  <div key={a.userId} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12 }}>
                    <span style={{ flex: 1, color: DARK, fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.userName}</span>
                    <div style={{ flex: 2, height: 6, background: "#f0ece5", borderRadius: 5, overflow: "hidden" }}><div style={{ width: `${pct}%`, height: "100%", background: pct >= 90 ? RED : GOLD }} /></div>
                    <span style={{ width: 64, textAlign: "right", color: "#6b7280" }}>{fmtTok(a.total)}</span>
                    <span style={{ width: 54, textAlign: "right", color: "#6b7280" }}>{usd(a.cost)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Personnalisation du tableau de bord ────────────────────────────
function CustomizePanel({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [kpis, setKpis] = useState<string[]>([]);
  const [blocks, setBlocks] = useState<string[]>([]);
  const [avKpis, setAvKpis] = useState<{ id: string; label: string }[]>([]);
  const [avBlocks, setAvBlocks] = useState<{ id: string; label: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/me/dashboard-prefs").then(r => r.ok ? r.json() : null).then(d => {
      if (d) { setKpis(d.kpis ?? []); setBlocks(d.blocks ?? []); setAvKpis(d.availableKpis ?? []); setAvBlocks(d.availableBlocks ?? []); }
    }).finally(() => setLoading(false));
  }, []);

  const toggleKpi = (id: string) => setKpis(p => p.includes(id) ? p.filter(x => x !== id) : (p.length >= 4 ? p : [...p, id]));
  const toggleBlock = (id: string) => setBlocks(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id]);

  async function save() {
    setSaving(true);
    await fetch("/api/me/dashboard-prefs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kpis, blocks }) }).catch(() => {});
    setSaving(false); onSaved();
  }

  const row = (checked: boolean, label: string, onClick: () => void, dim?: boolean): React.ReactNode => (
    <label onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, cursor: dim ? "not-allowed" : "pointer", background: checked ? GOLD_BG : "#fff", border: `1px solid ${checked ? GOLD : BORDER}`, opacity: dim ? 0.5 : 1 }}>
      <span style={{ width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${checked ? GOLD : "#cbd5e1"}`, background: checked ? GOLD : "#fff", color: "#fff", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" }}>{checked ? "✓" : ""}</span>
      <span style={{ fontSize: 13, color: DARK }}>{label}</span>
    </label>
  );

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 60 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 520, maxWidth: "94vw", maxHeight: "88vh", overflow: "auto", background: "#fff", borderRadius: 14, zIndex: 61, boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
        <div style={{ padding: "14px 18px", borderBottom: `1px solid ${BORDER}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: DARK }}>⚙ Personnaliser mon tableau de bord</span>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af" }}>×</button>
        </div>
        {loading ? <div style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>Chargement…</div> : (
          <div style={{ padding: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: GOLD, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Indicateurs (max 4) · {kpis.length}/4</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
              {avKpis.map(k => row(kpis.includes(k.id), k.label, () => toggleKpi(k.id), !kpis.includes(k.id) && kpis.length >= 4))}
            </div>

            <div style={{ fontSize: 12, fontWeight: 700, color: GOLD, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>Blocs affichés</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {avBlocks.map(b => row(blocks.includes(b.id), b.label, () => toggleBlock(b.id)))}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 22 }}>
              <button onClick={onClose} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "9px 16px", fontSize: 13, cursor: "pointer" }}>Annuler</button>
              <button onClick={save} disabled={saving} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{saving ? "Enregistrement…" : "Enregistrer"}</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Météo locale + prévisions 3 jours ─────────────────────────────
interface WeatherData {
  city: string | null; region?: string | null; timezone?: string | null; time?: string | null;
  needsCity?: boolean; error?: string;
  current?: { temp: number; code: number; wind?: number; isDay?: boolean };
  daily?: { date: string; code: number; tmin: number; tmax: number }[];
  hourly?: { time: string; temp: number; code: number }[];
}

// Codes météo WMO → icône + libellé.
function wmo(code: number): { icon: string; label: string } {
  if (code === 0) return { icon: "☀️", label: "Ciel dégagé" };
  if (code === 1) return { icon: "🌤️", label: "Plutôt ensoleillé" };
  if (code === 2) return { icon: "⛅", label: "Partiellement nuageux" };
  if (code === 3) return { icon: "☁️", label: "Couvert" };
  if (code === 45 || code === 48) return { icon: "🌫️", label: "Brouillard" };
  if (code >= 51 && code <= 57) return { icon: "🌦️", label: "Bruine" };
  if (code >= 61 && code <= 67) return { icon: "🌧️", label: "Pluie" };
  if (code >= 71 && code <= 77) return { icon: "🌨️", label: "Neige" };
  if (code >= 80 && code <= 82) return { icon: "🌦️", label: "Averses" };
  if (code >= 85 && code <= 86) return { icon: "🌨️", label: "Averses de neige" };
  if (code >= 95) return { icon: "⛈️", label: "Orage" };
  return { icon: "🌡️", label: "—" };
}

function weatherJoke(daily?: WeatherData["daily"]): string {
  const rainy = (daily ?? []).some(d => (d.code >= 51 && d.code <= 67) || (d.code >= 80 && d.code <= 99));
  const sunny = (daily ?? []).every(d => d.code <= 3);
  if (rainy) return "☂️ Glissez un parapluie dans la voiture : on cale les visites entre deux averses — personne n'achète sous la drache !";
  if (sunny) return "😎 Grand beau prévu : le soleil reste votre meilleur négociateur pour les visites de la semaine.";
  return "🗓️ Un œil sur le ciel pour caler vos visites au bon moment — un bien se vend mieux sous un joli ciel !";
}


// Météo intégrée au bandeau (thème sombre, à droite de la citation).
function dayLabelFull(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const diff = Math.round((+new Date(d.getFullYear(), d.getMonth(), d.getDate()) - +t) / 86_400_000);
  if (diff === 0) return "Aujourd'hui";
  return `${DAYS[d.getDay()].slice(0, 3).toLowerCase()}. ${d.getDate()}`;
}

// Carte météo façon « Google » : ville + heure, température, conditions,
// jours défilables et courbe horaire. Bascule °C/°F. Ville modifiable.
function WeatherCard() {
  const [w, setW] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [cityInput, setCityInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [err, setErr] = useState("");
  const [unit, setUnit] = useState<"C" | "F">("C");

  const load = () => { setLoading(true); fetch("/api/weather").then(r => r.json()).then(d => setW(d)).catch(() => setW({ city: null, error: "indisponible" })).finally(() => setLoading(false)); };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const currentCity = w?.city ?? null;
  const conv = (c: number) => unit === "C" ? c : Math.round(c * 9 / 5 + 32);

  function startEdit() { setCityInput(currentCity ?? ""); setErr(""); setEditing(true); }
  async function saveCity() {
    if (!cityInput.trim()) return;
    setSaving(true); setErr("");
    let ok = false, msg = "";
    try {
      const r = await fetch("/api/me/city", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ city: cityInput.trim() }) });
      const d = await r.json().catch(() => ({}));
      ok = r.ok; if (!ok) msg = d?.error || "Échec de l'enregistrement.";
    } catch { msg = "Erreur réseau."; }
    setSaving(false);
    if (ok) { setEditing(false); load(); } else setErr(msg);
  }

  const card: React.CSSProperties = { background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: "14px 16px", width: "100%", boxShadow: "0 6px 20px rgba(28,26,23,0.18)" };

  // Saisie / modification de la ville.
  if (editing || (!loading && w?.needsCity)) {
    return (
      <div style={card}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: DARK, marginBottom: 4 }}>🌦️ Météo locale</div>
        <div style={{ fontSize: 12.5, color: "#6b7280", marginBottom: 10 }}>{currentCity ? "Changer la ville affichée :" : "Indiquez votre ville pour afficher la météo et caler vos visites."}</div>
        <div style={{ display: "flex", gap: 8, maxWidth: 420 }}>
          <input value={cityInput} onChange={e => setCityInput(e.target.value)} onKeyDown={e => e.key === "Enter" && saveCity()} placeholder="ex. Carcassonne" autoFocus style={{ flex: 1, height: 36, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "0 12px", fontSize: 13, outline: "none" }} />
          <button onClick={saveCity} disabled={saving} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "0 18px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{saving ? "…" : "Valider"}</button>
          {currentCity && <button onClick={() => { setEditing(false); setErr(""); }} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "0 14px", fontSize: 13, cursor: "pointer" }}>Annuler</button>}
        </div>
        {err && <div style={{ fontSize: 12, color: "#dc2626", marginTop: 8 }}>{err}</div>}
      </div>
    );
  }

  if (loading) return <div style={{ ...card, color: "#9ca3af", fontSize: 12.5 }}>Météo en cours de chargement…</div>;

  if (!w || w.error || !w.current) {
    return (
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: DARK }}>📍 {currentCity ?? "Ville non définie"}</div>
            <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 3 }}>Météo momentanément indisponible{w?.error ? ` (${w.error})` : ""}.</div>
          </div>
          <button onClick={startEdit} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "6px 12px", fontSize: 12.5, color: GOLD, cursor: "pointer", fontWeight: 600 }}>✎ Changer de ville</button>
        </div>
      </div>
    );
  }

  const cur = wmo(w.current.code);
  const windy = (w.current.wind ?? 0) >= 30;
  const condition = windy ? `${cur.label}/Venteux` : cur.label;
  const today = w.daily?.[0];
  const localHM = w.time ? w.time.slice(11, 16) : "";

  const unitBtn = (u: "C" | "F"): React.CSSProperties => ({
    background: unit === u ? "#1C1A17" : "transparent", color: unit === u ? "#fff" : "#6b7280",
    border: "none", borderRadius: 8, padding: "4px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer",
  });

  return (
    <div style={card}>
      {/* En-tête : ville + heure + bascule unité */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: DARK }}>
            {w.city}{w.region ? `, ${w.region}` : ""}{localHM ? <span style={{ color: "#6b7280", fontWeight: 600 }}>  {localHM}</span> : null}
          </div>
          <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 2 }}>Mis à jour à l'instant</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button onClick={startEdit} title="Changer de ville" style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "4px 9px", fontSize: 12, color: GOLD, cursor: "pointer", fontWeight: 600 }}>✎ ville</button>
          <div style={{ display: "flex", background: "#f3f4f6", borderRadius: 9, padding: 2 }}>
            <button onClick={() => setUnit("F")} style={unitBtn("F")}>°F</button>
            <button onClick={() => setUnit("C")} style={unitBtn("C")}>°C</button>
          </div>
        </div>
      </div>

      {/* Conditions actuelles */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, margin: "12px 0 4px" }}>
        <div style={{ fontSize: 54, lineHeight: 1 }}>{cur.icon}</div>
        <div style={{ fontSize: 46, fontWeight: 800, color: DARK, lineHeight: 1 }}>{conv(w.current.temp)}<span style={{ fontSize: 22, verticalAlign: "super" }}>°{unit}</span></div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: DARK }}>{condition}</div>
          {today && <div style={{ fontSize: 12.5, color: "#6b7280", marginTop: 3 }}>Max. {conv(today.tmax)}° &nbsp; Min. {conv(today.tmin)}°</div>}
        </div>
      </div>

      {/* Jours (défilables) */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", padding: "10px 0 6px", borderTop: `1px solid ${BORDER}`, marginTop: 10 }}>
        {(w.daily ?? []).map((d, i) => {
          const wi = wmo(d.code);
          return (
            <div key={d.date} style={{ textAlign: "center", minWidth: 62, padding: "6px 6px", borderRadius: 12, background: i === 0 ? GOLD_BG : "transparent", flexShrink: 0 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: i === 0 ? GOLD : "#6b7280" }}>{dayLabelFull(d.date)}</div>
              <div style={{ fontSize: 26, margin: "3px 0" }}>{wi.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: DARK }}>{conv(d.tmax)}°<span style={{ color: "#9ca3af", fontWeight: 500 }}> {conv(d.tmin)}°</span></div>
            </div>
          );
        })}
      </div>

      {/* Courbe horaire */}
      <HourlyGraph hourly={w.hourly} conv={conv} />

      {/* Note « organisation des visites » */}
      <div style={{ fontSize: 11.5, color: "#8A6D44", background: GOLD_BG, borderRadius: 8, padding: "8px 12px", marginTop: 10 }}>{weatherJoke(w.daily)}</div>
    </div>
  );
}

// Courbe horaire (SVG) façon Google : aire dégradée + repères de température.
function HourlyGraph({ hourly, conv }: { hourly?: { time: string; temp: number; code: number }[]; conv: (c: number) => number }) {
  if (!hourly || hourly.length < 2) return null;
  const pts = hourly.slice(0, 24);
  const temps = pts.map(p => conv(p.temp));
  const min = Math.min(...temps), max = Math.max(...temps);
  const span = Math.max(1, max - min);
  const W = 600, H = 132, padX = 14, padTop = 26, padBot = 26;
  const x = (i: number) => padX + (i * (W - 2 * padX)) / (pts.length - 1);
  const y = (t: number) => padTop + (1 - (t - min) / span) * (H - padTop - padBot);
  const line = temps.map((t, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(t).toFixed(1)}`).join(" ");
  const area = `${line} L${x(pts.length - 1).toFixed(1)},${(H - padBot).toFixed(1)} L${x(0).toFixed(1)},${(H - padBot).toFixed(1)} Z`;
  const every = 3; // un repère toutes les 3 h

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", marginTop: 6 }} preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id="wgrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F0A98C" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#F0A98C" stopOpacity="0.03" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#wgrad)" />
      <path d={line} fill="none" stroke="#D98E6A" strokeWidth={2} strokeLinejoin="round" />
      {/* repère « maintenant » */}
      <line x1={x(0)} y1={padTop - 8} x2={x(0)} y2={H - padBot} stroke="#9ca3af" strokeWidth={1} strokeDasharray="3 3" />
      <circle cx={x(0)} cy={y(temps[0])} r={3.5} fill="#D98E6A" />
      {pts.map((p, i) => (i % every === 0 ? (
        <g key={i}>
          <text x={x(i)} y={y(temps[i]) - 8} textAnchor="middle" fontSize={11} fontWeight={700} fill="#374151">{temps[i]}°</text>
          <text x={x(i)} y={H - 8} textAnchor="middle" fontSize={10} fill="#9ca3af">{p.time.slice(11, 16)}</text>
        </g>
      ) : null))}
    </svg>
  );
}

// ─── Bandeau d'accueil « luxe » + citation inspirante ───────────────
const SERIF = "'Playfair Display', Georgia, 'Times New Roman', serif";
const QUOTES: { text: string; author: string }[] = [
  { text: "L'excellence n'est pas un acte, mais une habitude.", author: "Aristote" },
  { text: "La qualité n'est jamais un accident ; elle est toujours le fruit d'un effort intelligent.", author: "John Ruskin" },
  { text: "Le succès, c'est d'aller d'échec en échec sans perdre son enthousiasme.", author: "Winston Churchill" },
  { text: "Ce ne sont pas les murs qui font une maison, mais ceux qui l'habitent.", author: "Proverbe" },
  { text: "La meilleure façon de prédire l'avenir, c'est de le créer.", author: "Peter Drucker" },
  { text: "Un objectif sans plan n'est qu'un souhait.", author: "Antoine de Saint-Exupéry" },
  { text: "Le détail fait la perfection, et la perfection n'est pas un détail.", author: "Léonard de Vinci" },
  { text: "Rien de grand ne s'est accompli dans le monde sans passion.", author: "Hegel" },
  { text: "La simplicité est la sophistication suprême.", author: "Léonard de Vinci" },
  { text: "On ne construit pas une réputation sur ce que l'on a l'intention de faire.", author: "Henry Ford" },
  { text: "Là où il y a une volonté, il y a un chemin.", author: "Proverbe" },
  { text: "La patience et le temps font plus que la force et la rage.", author: "Jean de La Fontaine" },
  { text: "Le client le plus mécontent est votre plus grande source d'apprentissage.", author: "Bill Gates" },
  { text: "Seuls ceux qui osent aller trop loin savent jusqu'où l'on peut aller.", author: "T. S. Eliot" },
  { text: "Chaque jour est une nouvelle occasion de faire mieux qu'hier.", author: "Proverbe" },
  { text: "La persévérance est la noblesse de l'obstination.", author: "Adrien Decourcelle" },
  { text: "Le talent sans travail n'est qu'une habitude perdue.", author: "Proverbe" },
  { text: "Faites de chaque rencontre une raison d'exceller.", author: "Anonyme" },
  { text: "La réussite appartient à ceux qui se lèvent tôt et se couchent inspirés.", author: "Anonyme" },
  { text: "Bâtir la confiance prend des années ; l'honorer, chaque jour.", author: "Anonyme" },
];

function weatherHint(code: number): string {
  if (code <= 1) return "grand soleil — parfait pour enchaîner les visites";
  if (code <= 3) return "ciel calme — belle journée pour prospecter";
  if (code >= 45 && code <= 48) return "brouillard — prudence sur la route";
  if (code >= 51 && code <= 67) return "pluie en vue — gardez un parapluie à portée";
  if (code >= 71 && code <= 86) return "temps hivernal — prévoyez de la marge sur vos trajets";
  if (code >= 95) return "orages possibles — anticipez vos déplacements";
  return "bonne journée à vous";
}

function Banner({ firstName, kpis, onCustomize, onReorderKpis }: { firstName: string; kpis: { id?: string; label: string; value: string; sub?: string }[]; onCustomize: () => void; onReorderKpis?: (ids: string[]) => void }) {
  // Citation différente à chaque ouverture de page (après montage, pour éviter
  // toute incohérence d'hydratation SSR).
  const [i, setI] = useState(0);
  const [dragKpi, setDragKpi] = useState<string | null>(null);
  const canDrag = !!onReorderKpis && kpis.every(k => !!k.id);
  const dropKpi = (targetId: string) => {
    if (!dragKpi || dragKpi === targetId) return;
    const ids = kpis.map(k => k.id!) ;
    const fi = ids.indexOf(dragKpi), ti = ids.indexOf(targetId);
    if (fi < 0 || ti < 0) return;
    ids.splice(ti, 0, ids.splice(fi, 1)[0]);
    onReorderKpis?.(ids); setDragKpi(null);
  };
  const [wx, setWx] = useState<{ temp: number; code: number; city: string } | null>(null);
  useEffect(() => { setI(Math.floor(Math.random() * QUOTES.length)); }, []);
  useEffect(() => {
    fetch("/api/weather").then(r => r.ok ? r.json() : null).then(d => {
      if (d?.current && d?.city) setWx({ temp: d.current.temp, code: d.current.code, city: d.city });
    }).catch(() => {});
  }, []);
  const q = QUOTES[i];

  return (
    <div style={{
      position: "relative", overflow: "hidden", borderRadius: 16, padding: "22px 28px", marginBottom: 20,
      background: "#FCFAF6", color: DARK,
      boxShadow: "0 6px 22px rgba(28,26,23,0.06)", border: `1px solid ${BORDER}`,
    }}>
      <div style={{ position: "relative", display: "flex", alignItems: "stretch", justifyContent: "space-between", gap: 28, flexWrap: "wrap" }}>
        {/* Accueil + météo locale + stats + citation */}
        <div style={{ flex: "1 1 380px", minWidth: 300, display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div style={{ fontSize: 10.5, letterSpacing: "0.2em", textTransform: "uppercase", color: GOLD }}>{todayStr()}</div>
            <button onClick={onCustomize} title="Personnaliser mon tableau de bord" style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "4px 10px", fontSize: 11.5, color: GOLD, fontWeight: 600, cursor: "pointer" }}>⚙ Personnaliser</button>
          </div>
          <div style={{ fontFamily: SERIF, fontSize: 30, fontWeight: 600, marginTop: 7, color: DARK }}>{greet(firstName)}</div>

          {/* Message de bienvenue adapté à la météo locale */}
          {wx && (
            <div style={{ fontSize: 13.5, color: "#6b7280", marginTop: 8 }}>
              {wmo(wx.code).icon} Il fait <b style={{ color: DARK }}>{wx.temp}°</b> à <b style={{ color: GOLD }}>{wx.city}</b> — {weatherHint(wx.code)}.
            </div>
          )}

          {/* Indicateurs */}
          {kpis.length > 0 && (
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
              {kpis.map((k, n) => (
                <div key={k.id ?? n}
                  draggable={canDrag}
                  onDragStart={() => canDrag && setDragKpi(k.id ?? null)}
                  onDragEnd={() => setDragKpi(null)}
                  onDragOver={e => { if (dragKpi) e.preventDefault(); }}
                  onDrop={e => { e.preventDefault(); if (k.id) dropKpi(k.id); }}
                  title={canDrag ? "Glisser pour réorganiser les indicateurs" : undefined}
                  style={{ flex: "1 1 150px", minWidth: 140, background: "#fff", border: `1px solid ${dragKpi === k.id ? GOLD : BORDER}`, borderRadius: 12, padding: "11px 14px", cursor: canDrag ? "grab" : "default" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.04em" }}>{k.label}</div>
                  <div style={{ fontSize: 21, fontWeight: 800, color: DARK, marginTop: 3 }}>{k.value}</div>
                  {k.sub && <div style={{ fontSize: 10.5, color: GOLD, marginTop: 2 }}>{k.sub}</div>}
                </div>
              ))}
            </div>
          )}

          {/* Budget Auguste (coût API réel + estimé) — super admin uniquement */}
          <AugusteBudgetBanner />

          <div style={{ flex: 1 }} />

          <div style={{ width: 48, height: 1, background: "linear-gradient(90deg, #D8B783, transparent)", margin: "16px 0 12px" }} />

          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, maxWidth: 600 }}>
            <span style={{ fontFamily: SERIF, fontSize: 36, lineHeight: 0.7, color: GOLD, marginTop: 7, flexShrink: 0 }}>“</span>
            <div>
              <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 15.5, lineHeight: 1.5, color: "#3a342c" }}>{q.text}</div>
              <div style={{ fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: GOLD, marginTop: 8 }}>— {q.author}</div>
            </div>
          </div>
        </div>

        {/* Météo à droite */}
        <div style={{ flex: "0 1 390px", minWidth: 280, display: "flex" }}>
          <WeatherCard />
        </div>
      </div>
    </div>
  );
}
