"use client";
import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  GCalendar, GEvent, GCalConfig,
  loadToken, saveToken, clearToken, isTokenValid,
  loadConfig, saveConfig, saveSelectedCalendars,
  loadCalendarList, saveCalendarList, clearCalendarList,
  loadGapiAndGis, requestToken, fetchCalendars, fetchEvents,
} from "@/lib/googleCalendar";
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

function gEventToLocal(e: GEvent, color: string): LocalEvent {
  return {
    id: `g-${e.id}`,
    title: e.summary ?? "(Sans titre)",
    start: e.start.dateTime ?? e.start.date ?? "",
    end:   e.end.dateTime   ?? e.end.date   ?? "",
    color,
    description: e.description,
    location: e.location,
    type: "google",
    calendarId: e.calendarId,
    htmlLink: e.htmlLink,
  };
}

export default function PlanningBoard() {
  const { data: session } = useSession();
  const userId = (session?.user as { id?: string } | undefined)?.id;

  const [view, setView] = useState<"month" | "week" | "day">("week");
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [showSync, setShowSync] = useState(false);
  const [showNewEvent, setShowNewEvent] = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<LocalEvent | null>(null);
  const [editingEvent, setEditingEvent] = useState<LocalEvent | null>(null);

  // Local events
  const [localEvents, setLocalEvents] = useState<LocalEvent[]>([]);

  // Google state
  const [config, setConfig] = useState<GCalConfig | null>(null);
  const [connected, setConnected] = useState(false);
  const [calendars, setCalendars] = useState<GCalendar[]>([]);
  const [gEvents, setGEvents] = useState<LocalEvent[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);

  // Charger les événements depuis la BDD
  const fetchDbEvents = useCallback(async () => {
    try {
      const r = await fetch("/api/calendar");
      if (!r.ok) return;
      const data = await r.json();
      const events: LocalEvent[] = (data || []).map((e: Record<string, unknown>) => ({
        id:          e.id as string,
        title:       e.title as string,
        start:       e.start as string,
        end:         e.end as string,
        color:       (e.color as string) || "#B8966A",
        description: e.description as string | undefined,
        location:    e.location as string | undefined,
        type:        "local" as const,
        attendees:   (e.attendees as LocalEvent["attendees"]) ?? [],
      }));
      setLocalEvents(events);
    } catch { /* silencieux */ }
  }, []);

  // Load saved config + events BDD on mount — déclenché quand userId est connu
  useEffect(() => {
    if (userId === undefined) return; // session pas encore chargée
    const cfg = loadConfig(userId);
    if (cfg) setConfig(cfg);
    const token = loadToken(userId);
    const valid = token && isTokenValid(token);
    if (valid) {
      setConnected(true);
      // Restaurer la liste des agendas depuis le cache localStorage
      const cached = loadCalendarList(userId);
      if (cached.length > 0) {
        setCalendars(cached);
        // Auto-sync avec les agendas en cache
        syncGoogle(token.access_token, cached);
      } else {
        // Aucun cache → refetch
        fetchCalendars(token.access_token)
          .then(cals => {
            setCalendars(cals);
            saveCalendarList(cals, userId);
            syncGoogle(token.access_token, cals);
          })
          .catch(() => setConnected(false));
      }
    }
    fetchDbEvents();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, fetchDbEvents]);

  // Rafraîchir quand Auguste crée/modifie un événement
  useEffect(() => {
    const handler = () => fetchDbEvents();
    window.addEventListener("collab:event_created", handler);
    window.addEventListener("collab:event_updated", handler);
    return () => {
      window.removeEventListener("collab:event_created", handler);
      window.removeEventListener("collab:event_updated", handler);
    };
  }, [fetchDbEvents]);

  const getTimeRange = useCallback(() => {
    const d = new Date(currentDate);
    let min: Date, max: Date;
    if (view === "month") {
      min = new Date(d.getFullYear(), d.getMonth(), 1);
      max = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
    } else if (view === "week") {
      const day = d.getDay();
      min = new Date(d); min.setDate(d.getDate() - day + 1); min.setHours(0, 0, 0);
      max = new Date(min); max.setDate(min.getDate() + 6); max.setHours(23, 59, 59);
    } else {
      min = new Date(d); min.setHours(0, 0, 0);
      max = new Date(d); max.setHours(23, 59, 59);
    }
    return { min, max };
  }, [currentDate, view]);

  const syncGoogle = useCallback(async (token: string, cals: GCalendar[]) => {
    setSyncing(true);
    setSyncError(null);
    try {
      const { min, max } = getTimeRange();
      const timeMin = min.toISOString();
      const timeMax = max.toISOString();
      const selected = cals.filter(c => c.selected);
      const allEvents: LocalEvent[] = [];
      for (const cal of selected) {
        const evts = await fetchEvents(cal.id, token, timeMin, timeMax);
        for (const e of evts) allEvents.push(gEventToLocal(e, cal.backgroundColor ?? "#B8966A"));
      }
      setGEvents(allEvents);
      setLastSync(new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }));
    } catch (err: unknown) {
      setSyncError(err instanceof Error ? err.message : "Erreur de synchronisation");
    } finally {
      setSyncing(false);
    }
  }, [getTimeRange]);

  async function handleConnect(cfg: GCalConfig) {
    saveConfig(cfg, userId);
    setConfig(cfg);
    setSyncError(null);
    try {
      await loadGapiAndGis();
      const token = await requestToken(cfg.clientId);
      saveToken(token, userId);
      setConnected(true);
      const cals = await fetchCalendars(token.access_token);
      setCalendars(cals);
      saveCalendarList(cals, userId);
      await syncGoogle(token.access_token, cals);
    } catch (err: unknown) {
      setSyncError(err instanceof Error ? err.message : "Connexion échouée");
    }
  }

  async function handleSync() {
    const token = loadToken(userId);
    if (!token || !isTokenValid(token)) {
      if (!config) { setShowSync(true); return; }
      try {
        await loadGapiAndGis();
        const newToken = await requestToken(config.clientId);
        saveToken(newToken, userId);
        const cals = await fetchCalendars(newToken.access_token);
        setCalendars(cals);
        saveCalendarList(cals, userId);
        await syncGoogle(newToken.access_token, cals);
      } catch (err: unknown) {
        setSyncError(err instanceof Error ? err.message : "Reconnexion nécessaire");
      }
      return;
    }
    await syncGoogle(token.access_token, calendars);
  }

  function handleDisconnect() {
    clearToken(userId);
    clearCalendarList(userId);
    setConnected(false);
    setCalendars([]);
    setGEvents([]);
    setLastSync(null);
  }

  async function handleCalendarToggle(calId: string, selected: boolean) {
    const updated = calendars.map(c => c.id === calId ? { ...c, selected } : c);
    setCalendars(updated);
    saveSelectedCalendars(updated.filter(c => c.selected).map(c => c.id), userId);
    saveCalendarList(updated, userId);
    const token = loadToken(userId);
    if (token && isTokenValid(token)) await syncGoogle(token.access_token, updated);
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

  const allEvents = [...localEvents, ...gEvents];

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

        {/* Sync status */}
        {connected && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#6b7280" }}>
            {syncing ? (
              <span style={{ color: "#B8966A" }}>🔄 Synchronisation…</span>
            ) : syncError ? (
              <span style={{ color: "#dc2626" }}>⚠ {syncError}</span>
            ) : lastSync ? (
              <span style={{ color: "#059669" }}>✓ Sync {lastSync}</span>
            ) : null}
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
          {connected ? "Synchroniser" : "Connecter Google"}
        </button>

        <button onClick={() => setShowSync(true)} style={{ ...btnSecondary, display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 14 }}>📅</span> Agendas Google
          {connected && <span style={{ background: "#B8966A", color: "#fff", borderRadius: 8, padding: "1px 6px", fontSize: 10 }}>{calendars.filter(c => c.selected).length}</span>}
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

      {/* Calendar legend */}
      {connected && calendars.length > 0 && (
        <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "6px 20px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600 }}>AGENDAS :</span>
          {calendars.filter(c => c.selected).map(c => (
            <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: c.backgroundColor }} />
              <span style={{ fontSize: 11, color: "#374151" }}>{c.summary}</span>
            </div>
          ))}
          <span style={{ marginLeft: "auto", fontSize: 11, color: "#9ca3af" }}>
            {gEvents.length} événement(s) Google · {localEvents.length} local/aux
          </span>
        </div>
      )}

      {/* Calendar */}
      <CalendarView
        view={view}
        currentDate={currentDate}
        events={allEvents}
        onSelectDate={(d) => setShowNewEvent(d)}
        onSelectEvent={(e) => setSelectedEvent(e)}
      />

      {/* Panels */}
      {showSync && (
        <GoogleSyncPanel
          config={config}
          connected={connected}
          calendars={calendars}
          syncing={syncing}
          syncError={syncError}
          onConnect={handleConnect}
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
              setLocalEvents(p => p.filter(e => e.id !== selectedEvent.id));
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
