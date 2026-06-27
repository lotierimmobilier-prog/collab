"use client";
import { useState, useEffect, useCallback } from "react";
import CalendarView from "./CalendarView";
import GoogleSyncPanel from "./GoogleSyncPanel";
import EventModal from "./EventModal";

export interface LocalEvent {
  id: string;
  title: string;
  start: string;       // ISO datetime
  end: string;
  color: string;
  description?: string;
  location?: string;
  type: "local" | "google";
  calendarId?: string;
  htmlLink?: string;
  attendees?: { type: "user" | "contact"; id?: string; name: string; email: string }[];
}

export interface GCal { id: string; summary: string; backgroundColor?: string; primary?: boolean }
export interface GStatus { connected: boolean; email: string | null; calendars: GCal[]; selected: string[]; configured?: boolean }

export default function PlanningBoard() {
  const [view, setView] = useState<"month" | "week" | "day">("week");
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [showSync, setShowSync] = useState(false);
  const [showNewEvent, setShowNewEvent] = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<LocalEvent | null>(null);
  const [editingEvent, setEditingEvent] = useState<LocalEvent | null>(null);

  // Tous les événements (internes + Google) proviennent de /api/calendar :
  // l'agenda Google est fusionné côté serveur (connexion permanente).
  const [events, setEvents] = useState<LocalEvent[]>([]);
  const [gstatus, setGstatus] = useState<GStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [notice, setNotice] = useState<{ msg: string; ok: boolean } | null>(null);

  // Message de retour de la connexion Google (?gcal=...), puis on nettoie l'URL.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get("gcal");
    if (!p) return;
    const M: Record<string, { msg: string; ok: boolean }> = {
      connecte: { msg: "Agenda Google connecté — il restera affiché en permanence.", ok: true },
      refus: { msg: "Connexion Google annulée.", ok: false },
      invalide: { msg: "Lien de connexion expiré, réessayez.", ok: false },
      erreur: { msg: "Échec de la connexion Google, réessayez.", ok: false },
      sans_refresh: { msg: "Google n'a pas renvoyé d'autorisation hors-ligne. Révoquez l'accès « Collab » dans votre compte Google puis reconnectez.", ok: false },
    };
    setNotice(M[p] ?? null);
    window.history.replaceState(null, "", "/planning");
    const t = setTimeout(() => setNotice(null), 8000);
    return () => clearTimeout(t);
  }, []);

  const fetchDbEvents = useCallback(async () => {
    try {
      const r = await fetch("/api/calendar");
      if (!r.ok) return;
      const data = await r.json();
      const list: LocalEvent[] = (data || []).map((e: Record<string, unknown>) => ({
        id:          e.id as string,
        title:       e.title as string,
        start:       e.start as string,
        end:         e.end as string,
        color:       (e.color as string) || "#B8966A",
        description: e.description as string | undefined,
        location:    e.location as string | undefined,
        type:        (e.source === "google" || e.type === "google") ? "google" as const : "local" as const,
        htmlLink:    e.htmlLink as string | undefined,
        attendees:   (e.attendees as LocalEvent["attendees"]) ?? [],
      }));
      setEvents(list);
    } catch { /* silencieux */ }
  }, []);

  const loadStatus = useCallback(async () => {
    try { const r = await fetch("/api/google/calendar/status"); if (r.ok) setGstatus(await r.json()); } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchDbEvents(); loadStatus(); }, [fetchDbEvents, loadStatus]);

  // Rafraîchir quand Auguste crée/modifie un événement.
  useEffect(() => {
    const handler = () => fetchDbEvents();
    window.addEventListener("collab:event_created", handler);
    window.addEventListener("collab:event_updated", handler);
    return () => {
      window.removeEventListener("collab:event_created", handler);
      window.removeEventListener("collab:event_updated", handler);
    };
  }, [fetchDbEvents]);

  // Rafraîchissement périodique (affichage « temps réel »).
  useEffect(() => {
    const t = setInterval(fetchDbEvents, 120_000);
    return () => clearInterval(t);
  }, [fetchDbEvents]);

  async function handleSync() {
    if (!gstatus?.connected) { window.location.href = "/api/google/calendar/connect"; return; }
    setSyncing(true);
    await fetchDbEvents();
    await loadStatus();
    setSyncing(false);
  }

  async function handleDisconnect() {
    await fetch("/api/google/calendar/disconnect", { method: "POST" });
    await loadStatus();
    await fetchDbEvents();
  }

  async function handleCalendarToggle(calId: string, selected: boolean) {
    if (!gstatus) return;
    const next = selected ? [...gstatus.selected, calId] : gstatus.selected.filter(i => i !== calId);
    setGstatus({ ...gstatus, selected: next });
    await fetch("/api/google/calendar/select", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ selected: next }) });
    await fetchDbEvents();
  }

  function addLocalEvent(_evt: LocalEvent) {
    fetchDbEvents();
    setShowNewEvent(null);
  }

  function handleEditSave(_evt: LocalEvent) {
    fetchDbEvents();
    setEditingEvent(null);
    setSelectedEvent(null);
  }

  const connected = !!gstatus?.connected;
  const selectedCount = gstatus?.selected.length ?? 0;
  const googleCount = events.filter(e => e.type === "google").length;
  const selectedCals = (gstatus?.calendars ?? []).filter(c => gstatus?.selected.includes(c.id));

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
      {/* Toolbar */}
      <div style={{
        background: "#fff", borderBottom: "1px solid #e5e7eb",
        padding: "10px 20px", display: "flex", alignItems: "center", gap: 10,
      }}>
        {/* Navigation */}
        <button onClick={() => nav(-1)} style={iconBtn}>‹</button>
        <button onClick={() => setCurrentDate(new Date())} style={btnSecondary}>Aujourd'hui</button>
        <button onClick={() => nav(1)} style={iconBtn}>›</button>
        <span style={{ fontSize: 15, fontWeight: 600, color: "#111827", minWidth: 200 }}>
          {formatHeader(currentDate, view)}
        </span>

        <div style={{ flex: 1 }} />

        {/* Statut de connexion */}
        {connected && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#059669" }}>
            <span>✓ Google connecté</span>
          </div>
        )}

        <button
          onClick={handleSync}
          disabled={syncing}
          style={{
            ...btnSecondary,
            display: "flex", alignItems: "center", gap: 6,
            background: connected ? "#f0fdf4" : "#f9fafb",
            color: connected ? "#059669" : "#374151",
            border: `1px solid ${connected ? "#bbf7d0" : "#e5e7eb"}`,
          }}
        >
          <span style={{ fontSize: 14 }}>🔄</span>
          {connected ? (syncing ? "Actualisation…" : "Actualiser") : "Connecter Google"}
        </button>

        <button onClick={() => setShowSync(true)} style={{ ...btnSecondary, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 14 }}>📅</span> Agendas Google
          {connected && <span style={{ background: "#B8966A", color: "#fff", borderRadius: 8, padding: "1px 6px", fontSize: 10 }}>{selectedCount}</span>}
        </button>

        {/* View toggle */}
        <div style={{ display: "flex", border: "1px solid #e5e7eb", borderRadius: 8, overflow: "hidden" }}>
          {(["month", "week", "day"] as const).map(v => (
            <button key={v} onClick={() => setView(v)} style={{
              padding: "6px 12px", fontSize: 12, border: "none", cursor: "pointer",
              background: view === v ? "#B8966A" : "#fff",
              color: view === v ? "#fff" : "#6b7280",
            }}>{{ month: "Mois", week: "Semaine", day: "Jour" }[v]}</button>
          ))}
        </div>

        <button onClick={() => setShowNewEvent(new Date())} style={btnPrimary}>+ Événement</button>
      </div>

      {notice && (
        <div style={{ background: notice.ok ? "#f0fdf4" : "#fef2f2", borderBottom: `1px solid ${notice.ok ? "#bbf7d0" : "#fecaca"}`, color: notice.ok ? "#166534" : "#991b1b", padding: "8px 20px", fontSize: 12.5 }}>
          {notice.ok ? "✓ " : "⚠ "}{notice.msg}
        </div>
      )}

      {/* Légende des agendas */}
      {connected && selectedCals.length > 0 && (
        <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "6px 20px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>AGENDAS :</span>
          {selectedCals.map(c => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: c.backgroundColor || "#4285F4" }} />
              <span style={{ fontSize: 11, color: "#374151" }}>{c.summary}</span>
            </div>
          ))}
          <span style={{ marginLeft: "auto", fontSize: 11, color: "#9ca3af" }}>
            {googleCount} événement(s) Google
          </span>
        </div>
      )}

      {/* Calendar */}
      <CalendarView
        view={view}
        currentDate={currentDate}
        events={events}
        onSelectDate={(d) => setShowNewEvent(d)}
        onSelectEvent={(e) => setSelectedEvent(e)}
      />

      {/* Panels */}
      {showSync && (
        <GoogleSyncPanel
          status={gstatus}
          syncing={syncing}
          onConnect={() => { window.location.href = "/api/google/calendar/connect"; }}
          onDisconnect={handleDisconnect}
          onToggleCalendar={handleCalendarToggle}
          onClose={() => setShowSync(false)}
          onSync={handleSync}
        />
      )}

      {showNewEvent && (
        <EventModal
          defaultDate={showNewEvent}
          onClose={() => setShowNewEvent(null)}
          onSave={addLocalEvent}
        />
      )}

      {selectedEvent && !editingEvent && (
        <EventDetail
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onEdit={() => setEditingEvent(selectedEvent)}
          onDelete={async () => {
            if (selectedEvent.type === "local") {
              await fetch(`/api/calendar/${selectedEvent.id}`, { method: "DELETE" });
              setEvents(p => p.filter(e => e.id !== selectedEvent.id));
            }
            setSelectedEvent(null);
          }}
        />
      )}

      {editingEvent && (
        <EventModal
          defaultDate={new Date(editingEvent.start)}
          event={editingEvent}
          onClose={() => setEditingEvent(null)}
          onSave={handleEditSave}
        />
      )}
    </div>
  );

  function nav(dir: number) {
    const d = new Date(currentDate);
    if (view === "month") d.setMonth(d.getMonth() + dir);
    else if (view === "week") d.setDate(d.getDate() + dir * 7);
    else d.setDate(d.getDate() + dir);
    setCurrentDate(d);
  }
}

function EventDetail({ event, onClose, onEdit, onDelete }: { event: LocalEvent; onClose: () => void; onEdit: () => void; onDelete: () => void }) {
  const start = event.start ? new Date(event.start) : null;
  const end = event.end ? new Date(event.end) : null;
  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 40 }} />
      <div style={{ position: "fixed", top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: 420, background: "#fff", borderRadius: 14, zIndex: 50, boxShadow: "0 20px 60px rgba(0,0,0,0.15)", overflow: "hidden" }}>
        <div style={{ height: 6, background: event.color }} />
        <div style={{ padding: "16px 20px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <div>
              {event.type === "google" && <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 4, display: "flex", alignItems: "center", gap: 4 }}><span>📅</span> Google Calendar</div>}
              <h2 style={{ fontSize: 16, fontWeight: 600, color: "#111827" }}>{event.title}</h2>
            </div>
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#9ca3af" }}>×</button>
          </div>
          {start && (
            <div style={{ fontSize: 13, color: "#374151", marginBottom: 8 }}>
              🕐 {start.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
              {event.start.includes("T") && ` · ${start.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`}
              {end && event.end.includes("T") && ` → ${end.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`}
            </div>
          )}
          {event.location && <div style={{ fontSize: 13, color: "#374151", marginBottom: 8 }}>📍 {event.location}</div>}
          {event.description && <div style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.5, marginBottom: 12 }}>{event.description}</div>}
          <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
            {event.htmlLink && (
              <a href={event.htmlLink} target="_blank" rel="noreferrer" style={{ ...btnSecondary, textDecoration: "none", fontSize: 12 }}>Ouvrir dans Google Calendar ↗</a>
            )}
            {event.type === "local" && (
              <button onClick={onEdit} style={{ background: "#F7F0E6", color: "#B8966A", border: "1px solid #E6D5C0", borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer", fontWeight: 500 }}>✏ Modifier</button>
            )}
            {event.type === "local" && (
              <button onClick={onDelete} style={{ background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer" }}>Supprimer</button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function formatHeader(date: Date, view: string): string {
  if (view === "month") return date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  if (view === "week") {
    const start = new Date(date);
    start.setDate(date.getDate() - date.getDay() + 1);
    const end = new Date(start); end.setDate(start.getDate() + 6);
    return `${start.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })} – ${end.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`;
  }
  return date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

const iconBtn: React.CSSProperties = { background: "none", border: "1px solid #e5e7eb", borderRadius: 8, padding: "5px 10px", cursor: "pointer", fontSize: 16, color: "#374151" };
const btnSecondary: React.CSSProperties = { background: "#fff", color: "#374151", border: "1px solid #e5e7eb", borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer" };
const btnPrimary: React.CSSProperties = { background: "#B8966A", color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 13, fontWeight: 500, cursor: "pointer" };
