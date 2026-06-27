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

// ─── Bloc Classement du trimestre ───────────────────────────────
interface RankRow { userId: string; name: string; roleId: string | null; counts: Record<string, number>; amount: number; total: number }

function fmtEuroShort(n: number): string {
  if (!n) return "0 €";
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} M€`;
  if (n >= 1_000) return `${(n / 1_000).toLocaleString("fr-FR", { maximumFractionDigits: 0 })} k€`;
  return `${n.toLocaleString("fr-FR")} €`;
}

function RankingBlock({ refreshKey, currentUserId }: { refreshKey: number; currentUserId?: string }) {
  const [data, setData]     = useState<{ quarterLabel: string; ranking: RankRow[]; totals: Record<string, number> } | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode]     = useState<"nombre" | "ca">("nombre");

  useEffect(() => {
    fetch("/api/performance/ranking").then(r => r.json())
      .then(d => setData(d?.ranking ? d : { quarterLabel: "", ranking: [], totals: {} }))
      .catch(() => setData({ quarterLabel: "", ranking: [], totals: {} }))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  const rankingRaw = data?.ranking ?? [];
  const ranking = mode === "ca"
    ? [...rankingRaw].sort((a, b) => b.amount - a.amount || b.total - a.total || a.name.localeCompare(b.name))
    : rankingRaw;
  const totals  = data?.totals ?? {};
  const totalCA = rankingRaw.reduce((s, r) => s + (r.amount || 0), 0);
  const medal = (i: number) => (i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`);

  // En mode « nombre » : colonnes par type + total des mandats.
  // En mode « CA » : une seule colonne chiffre d'affaires.
  const gridCols = mode === "ca" ? "28px 1fr 80px" : "28px 1fr repeat(4, 38px) 42px";

  const TabBtn = ({ id, label }: { id: "nombre" | "ca"; label: string }) => (
    <button onClick={() => setMode(id)} style={{
      background: mode === id ? GOLD : "#fff", color: mode === id ? "#fff" : "#6b7280",
      border: `1px solid ${mode === id ? GOLD : BORDER}`, borderRadius: 7, padding: "3px 9px",
      fontSize: 10.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
    }}>{label}</button>
  );

  return (
    <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${BORDER}`, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", overflow: "hidden" }}>
      <div style={{ padding: "14px 16px 10px", borderBottom: `1px solid #f3f4f6`, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>🏆 Classement du trimestre</span>
          {data?.quarterLabel && <span style={{ background: GOLD_BG, color: GOLD, borderRadius: 8, padding: "1px 8px", fontSize: 10, fontWeight: 700 }}>{data.quarterLabel}</span>}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <TabBtn id="nombre" label="Nombre" />
          <TabBtn id="ca" label="Chiffre d'affaires" />
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
            <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 4, alignItems: "center", padding: "0 4px 6px", fontSize: 9, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase" }}>
              <span></span><span></span>
              {mode === "ca" ? (
                <span style={{ textAlign: "right" }}>CA</span>
              ) : (
                <>
                  {PERF_TYPES.map(t => <span key={t.id} title={t.label} style={{ textAlign: "center" }}>{t.icon}</span>)}
                  <span style={{ textAlign: "center" }}>Mand.</span>
                </>
              )}
            </div>
            {ranking.slice(0, 8).map((r, i) => {
              const isMe = r.userId === currentUserId;
              return (
                <div key={r.userId} style={{ display: "grid", gridTemplateColumns: gridCols, gap: 4, alignItems: "center", padding: "6px 4px", borderTop: i === 0 ? "none" : "1px solid #f6f6f4", background: isMe ? GOLD_BG : "transparent", borderRadius: 6 }}>
                  <span style={{ fontSize: 13, textAlign: "center" }}>{medal(i)}</span>
                  <span style={{ fontSize: 12, fontWeight: isMe ? 700 : 500, color: "#111827", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.name}{isMe && <span style={{ color: GOLD, fontWeight: 700 }}> · vous</span>}
                  </span>
                  {mode === "ca" ? (
                    <span style={{ textAlign: "right", fontSize: 12.5, fontWeight: 700, color: r.amount ? GOLD : "#d1d5db" }}>{fmtEuroShort(r.amount || 0)}</span>
                  ) : (
                    <>
                      {PERF_TYPES.map(t => (
                        <span key={t.id} style={{ textAlign: "center", fontSize: 12, color: r.counts[t.id] ? t.color : "#d1d5db", fontWeight: r.counts[t.id] ? 700 : 400 }}>
                          {r.counts[t.id] ?? 0}
                        </span>
                      ))}
                      <span style={{ textAlign: "center", fontSize: 13, fontWeight: 700, color: GOLD }}>{r.total}</span>
                    </>
                  )}
                </div>
              );
            })}
            {/* Total agence */}
            <div style={{ display: "grid", gridTemplateColumns: gridCols, gap: 4, alignItems: "center", padding: "8px 4px 2px", marginTop: 4, borderTop: "2px solid #f3f4f6", fontSize: 11, fontWeight: 700, color: "#6b7280" }}>
              <span></span><span style={{ textTransform: "uppercase", fontSize: 10 }}>Total agence</span>
              {mode === "ca" ? (
                <span style={{ textAlign: "right", color: GOLD }}>{fmtEuroShort(totalCA)}</span>
              ) : (
                <>
                  {PERF_TYPES.map(t => <span key={t.id} style={{ textAlign: "center", color: t.color }}>{totals[t.id] ?? 0}</span>)}
                  <span style={{ textAlign: "center", color: GOLD }}>{PERF_TYPES.reduce((s, t) => s + (totals[t.id] ?? 0), 0)}</span>
                </>
              )}
            </div>
            <div style={{ marginTop: 8, fontSize: 10, color: "#9ca3af", textAlign: "center" }}>
              {mode === "ca"
                ? "Classement par chiffre d'affaires (honoraires encaissés ce trimestre)."
                : "Classement par nombre de mandats et d'opérations enregistrés."}
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
      {/* Bannière d'accueil — version luxe + citation inspirante */}
      <Banner firstName={firstName} />

      {/* Météo locale + prévisions 3 jours */}
      <WeatherBlock />


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

// ─── Météo locale + prévisions 3 jours ─────────────────────────────
interface WeatherData { city: string | null; needsCity?: boolean; error?: string; current?: { temp: number; code: number }; daily?: { date: string; code: number; tmin: number; tmax: number }[] }

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

function weekdayShort(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const t = new Date(); t.setHours(0, 0, 0, 0);
  const diff = Math.round((+new Date(d.getFullYear(), d.getMonth(), d.getDate()) - +t) / 86_400_000);
  if (diff === 0) return "Auj.";
  if (diff === 1) return "Demain";
  return DAYS[d.getDay()].slice(0, 3);
}

function WeatherBlock() {
  const [w, setW] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [cityInput, setCityInput] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => { setLoading(true); fetch("/api/weather").then(r => r.json()).then(d => setW(d)).catch(() => setW({ city: null, error: "indisponible" })).finally(() => setLoading(false)); };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  async function saveCity() {
    if (!cityInput.trim()) return;
    setSaving(true);
    await fetch("/api/me/city", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ city: cityInput.trim() }) }).catch(() => {});
    setSaving(false); setCityInput(""); load();
  }

  // Demande de ville (profil non renseigné).
  if (!loading && w?.needsCity) {
    return (
      <div style={{ ...weatherCard, marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: "#6b7280" }}>
          🌦️ Indiquez votre ville pour afficher la météo et organiser vos visites.
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <input value={cityInput} onChange={e => setCityInput(e.target.value)} onKeyDown={e => e.key === "Enter" && saveCity()} placeholder="Votre ville (ex. Bordeaux)" style={{ flex: 1, height: 34, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "0 10px", fontSize: 13, outline: "none" }} />
          <button onClick={saveCity} disabled={saving} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "0 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>{saving ? "…" : "Valider"}</button>
        </div>
      </div>
    );
  }

  if (loading || !w || w.error || !w.current) {
    return (
      <div style={{ ...weatherCard, marginBottom: 16, color: "#9ca3af", fontSize: 12.5 }}>
        {loading ? "Météo en cours de chargement…" : `Météo indisponible${w?.city ? ` pour ${w.city}` : ""}.`}
      </div>
    );
  }

  const cur = wmo(w.current.code);
  return (
    <div style={{ ...weatherCard, marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
        {/* Actuel */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 200 }}>
          <div style={{ fontSize: 40, lineHeight: 1 }}>{cur.icon}</div>
          <div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#1C1A17", lineHeight: 1 }}>{w.current.temp}°</div>
            <div style={{ fontSize: 12.5, color: "#6b7280", marginTop: 3 }}>{cur.label} · <b style={{ color: GOLD }}>{w.city}</b></div>
          </div>
        </div>

        <div style={{ flex: 1 }} />

        {/* Prévisions 3 jours */}
        <div style={{ display: "flex", gap: 8 }}>
          {(w.daily ?? []).map(d => {
            const wi = wmo(d.code);
            return (
              <div key={d.date} style={{ textAlign: "center", background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "8px 12px", minWidth: 64 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase" }}>{weekdayShort(d.date)}</div>
                <div style={{ fontSize: 22, margin: "2px 0" }}>{wi.icon}</div>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: "#374151" }}>{d.tmax}°<span style={{ color: "#9ca3af", fontWeight: 500 }}> / {d.tmin}°</span></div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Blague « organisation des visites » */}
      <div style={{ fontSize: 12, color: "#8A6D44", background: GOLD_BG, borderRadius: 8, padding: "8px 12px", marginTop: 12 }}>
        {weatherJoke(w.daily)}
      </div>
    </div>
  );
}
const weatherCard: React.CSSProperties = { background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: "16px 20px" };

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

function Banner({ firstName }: { firstName: string }) {
  // Citation différente à chaque ouverture de page (après montage, pour éviter
  // toute incohérence d'hydratation SSR).
  const [i, setI] = useState(0);
  useEffect(() => { setI(Math.floor(Math.random() * QUOTES.length)); }, []);
  const q = QUOTES[i];

  return (
    <div style={{
      position: "relative", overflow: "hidden", borderRadius: 16, padding: "26px 34px", marginBottom: 20,
      background: "linear-gradient(120deg, #1C1A17 0%, #3A3024 50%, #8A6A42 100%)", color: "#F7F0E6",
      boxShadow: "0 12px 32px rgba(28,26,23,0.28)", border: "1px solid rgba(184,150,106,0.35)",
    }}>
      {/* Monogramme filigrane */}
      <div style={{ position: "absolute", right: -8, top: "50%", transform: "translateY(-50%)", fontSize: 150, color: "rgba(247,240,230,0.06)", lineHeight: 1, pointerEvents: "none" }}>◈</div>
      {/* Lueur dorée discrète */}
      <div style={{ position: "absolute", right: 40, top: -60, width: 220, height: 220, borderRadius: "50%", background: "radial-gradient(circle, rgba(216,183,131,0.22), transparent 70%)", pointerEvents: "none" }} />

      <div style={{ position: "relative" }}>
        <div style={{ fontSize: 10.5, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(247,240,230,0.6)" }}>{todayStr()}</div>
        <div style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 600, marginTop: 7, letterSpacing: "0.01em" }}>{greet(firstName)}</div>

        <div style={{ width: 48, height: 1, background: "linear-gradient(90deg, #D8B783, transparent)", margin: "15px 0 13px" }} />

        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, maxWidth: 700 }}>
          <span style={{ fontFamily: SERIF, fontSize: 38, lineHeight: 0.7, color: "rgba(216,183,131,0.85)", marginTop: 8, flexShrink: 0 }}>“</span>
          <div>
            <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 16, lineHeight: 1.5, color: "rgba(247,240,230,0.96)" }}>{q.text}</div>
            <div style={{ fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: "#D8B783", marginTop: 9 }}>— {q.author}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
