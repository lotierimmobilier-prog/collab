"use client";
import { LocalEvent } from "./PlanningBoard";

const DAYS_FR   = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const START_H   = 8;    // première heure affichée
const END_H     = 20;   // dernière heure affichée (exclusive)
const HOURS     = Array.from({ length: END_H - START_H }, (_, i) => i + START_H);
const HOUR_H    = 64;   // pixels par heure
const MIN_H     = 22;   // hauteur minimale d'un événement (px)
const TIME_COL  = 56;   // largeur colonne heures

function fmt24(d: Date) {
  return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function parseLocal(iso: string): Date {
  // Les strings sans timezone sont traitées comme heure locale
  return new Date(iso);
}

interface Props {
  view: "month" | "week" | "day";
  currentDate: Date;
  events: LocalEvent[];
  onSelectDate: (d: Date) => void;
  onSelectEvent: (e: LocalEvent) => void;
}

export default function CalendarView({ view, currentDate, events, onSelectDate, onSelectEvent }: Props) {
  if (view === "month") return <MonthView {...{ currentDate, events, onSelectDate, onSelectEvent }} />;
  if (view === "week")  return <WeekView  {...{ currentDate, events, onSelectDate, onSelectEvent }} />;
  return <DayView {...{ currentDate, events, onSelectDate, onSelectEvent }} />;
}

/* ── utils ─────────────────────────────────────────────────── */

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

const GRID_H = (END_H - START_H) * HOUR_H; // hauteur totale de la grille

function minutesFromStart(d: Date) {
  return (d.getHours() - START_H) * 60 + d.getMinutes();
}

function topPx(d: Date) { return minutesFromStart(d) / 60 * HOUR_H; }
function heightPx(s: Date, e: Date) { return Math.max((e.getTime() - s.getTime()) / 3600000 * HOUR_H, MIN_H); }

/* ── TimeGrid shared ────────────────────────────────────────── */

function TimeGutter() {
  return (
    <div style={{ width: TIME_COL, flexShrink: 0, position: "relative", height: GRID_H }}>
      {HOURS.map((h, i) => (
        <div key={h} style={{ position: "absolute", top: i * HOUR_H - 8, right: 6, fontSize: 10, color: "#9ca3af", fontWeight: 500, userSelect: "none" }}>
          {`${String(h).padStart(2, "0")}:00`}
        </div>
      ))}
    </div>
  );
}

function HourLines() {
  return (
    <>
      {HOURS.map((h, i) => (
        <div key={h} style={{ position: "absolute", top: i * HOUR_H, left: 0, right: 0, borderTop: `1px solid ${i === 0 ? "#d1d5db" : "#f3f4f6"}`, zIndex: 0 }} />
      ))}
      {/* Demi-heures */}
      {HOURS.map((_, i) => (
        <div key={`h${i}30`} style={{ position: "absolute", top: i * HOUR_H + HOUR_H / 2, left: 0, right: 0, borderTop: "1px dashed #f9fafb", zIndex: 0 }} />
      ))}
    </>
  );
}

/* ── Event block ────────────────────────────────────────────── */

function EventBlock({ event, onSelectEvent, style }: {
  event: LocalEvent;
  onSelectEvent: (e: LocalEvent) => void;
  style?: React.CSSProperties;
}) {
  const s = parseLocal(event.start);
  const e = parseLocal(event.end);
  const hasTime = event.start.includes("T");
  const startStr = hasTime ? fmt24(s) : "";
  const endStr   = hasTime ? fmt24(e) : "";
  const h = hasTime ? heightPx(s, e) : HOUR_H;
  const duration = (e.getTime() - s.getTime()) / 60000; // minutes

  return (
    <div
      onClick={ev => { ev.stopPropagation(); onSelectEvent(event); }}
      style={{
        background: event.color,
        borderLeft: `3px solid ${event.color}`,
        backgroundColor: event.color + "CC",
        color: "#fff",
        borderRadius: 5,
        padding: h > 30 ? "3px 6px" : "1px 5px",
        boxSizing: "border-box",
        overflow: "hidden",
        cursor: "pointer",
        userSelect: "none",
        ...style,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.3, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
        {event.title}
      </div>
      {startStr && duration > 30 && (
        <div style={{ fontSize: 10, opacity: 0.92, marginTop: 1 }}>
          {startStr} – {endStr}
        </div>
      )}
      {event.location && h > 44 && (
        <div style={{ fontSize: 10, opacity: 0.8, marginTop: 1, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>
          📍 {event.location}
        </div>
      )}
    </div>
  );
}

/* ── Month view ─────────────────────────────────────────────── */

function MonthView({ currentDate, events, onSelectDate, onSelectEvent }: Omit<Props, "view">) {
  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay  = new Date(year, month, 1).getDay();
  const offset    = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMon = new Date(year, month + 1, 0).getDate();
  const today     = new Date();

  const cells: (Date | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInMon }, (_, i) => new Date(year, month, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div style={{ flex: 1, overflowY: "auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", background: "#fff", borderBottom: "1px solid #e5e7eb", position: "sticky", top: 0 }}>
        {DAYS_FR.map(d => (
          <div key={d} style={{ textAlign: "center", padding: "8px 0", fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase" }}>{d}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", background: "#fff" }}>
        {cells.map((d, i) => {
          const isToday = d && sameDay(d, today);
          const dayEvts = d ? events.filter(e => sameDay(parseLocal(e.start), d)).slice(0, 4) : [];
          return (
            <div key={i} onClick={() => d && onSelectDate(d)} style={{
              minHeight: 90, padding: "6px 6px 4px",
              borderRight: (i + 1) % 7 !== 0 ? "1px solid #f3f4f6" : "none",
              borderBottom: "1px solid #f3f4f6",
              background: d ? "#fff" : "#f9fafb",
              cursor: d ? "pointer" : "default",
            }}
              onMouseEnter={e => d && (e.currentTarget.style.background = "#fafafa")}
              onMouseLeave={e => d && (e.currentTarget.style.background = "#fff")}
            >
              {d && (
                <>
                  <div style={{
                    width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: isToday ? 700 : 400, marginBottom: 3,
                    background: isToday ? "#B8966A" : "transparent",
                    color: isToday ? "#fff" : d.getDay() === 0 || d.getDay() === 6 ? "#9ca3af" : "#111827",
                  }}>{d.getDate()}</div>
                  {dayEvts.map(e => {
                    const s = parseLocal(e.start);
                    const timeStr = e.start.includes("T") ? fmt24(s) + " " : "";
                    return (
                      <div key={e.id} onClick={ev => { ev.stopPropagation(); onSelectEvent(e); }} style={{
                        fontSize: 10, background: e.color, color: "#fff",
                        borderRadius: 4, padding: "2px 5px", marginBottom: 2,
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer",
                      }}>{timeStr}{e.title}</div>
                    );
                  })}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Week view ──────────────────────────────────────────────── */

function WeekView({ currentDate, events, onSelectDate, onSelectEvent }: Omit<Props, "view">) {
  const monday = new Date(currentDate);
  monday.setDate(currentDate.getDate() - (currentDate.getDay() === 0 ? 6 : currentDate.getDay() - 1));
  const days  = Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d; });
  const today = new Date();

  function eventsForDay(d: Date) {
    return events.filter(e => e.start.includes("T") && sameDay(parseLocal(e.start), d));
  }

  const allDayEvents = (d: Date) => events.filter(e => !e.start.includes("T") && sameDay(parseLocal(e.start), d));

  return (
    <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
      {/* Header jours */}
      <div style={{ display: "grid", gridTemplateColumns: `${TIME_COL}px repeat(7,1fr)`, background: "#fff", borderBottom: "1px solid #e5e7eb", position: "sticky", top: 0, zIndex: 20, flexShrink: 0 }}>
        <div style={{ borderRight: "1px solid #e5e7eb" }} />
        {days.map((d, i) => {
          const isToday = sameDay(d, today);
          const allDay  = allDayEvents(d);
          return (
            <div key={i} style={{ borderLeft: "1px solid #f3f4f6" }}>
              <div style={{ textAlign: "center", padding: "6px 4px 4px" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase" }}>{DAYS_FR[i]}</div>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%", margin: "2px auto 0",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: isToday ? 700 : 400,
                  background: isToday ? "#B8966A" : "transparent",
                  color: isToday ? "#fff" : "#111827",
                }}>{d.getDate()}</div>
              </div>
              {allDay.length > 0 && (
                <div style={{ padding: "0 2px 4px" }}>
                  {allDay.map(e => (
                    <div key={e.id} onClick={() => onSelectEvent(e)} style={{ fontSize: 10, background: e.color, color: "#fff", borderRadius: 3, padding: "2px 4px", marginBottom: 2, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", cursor: "pointer" }}>{e.title}</div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Grille horaire */}
      <div style={{ display: "grid", gridTemplateColumns: `${TIME_COL}px repeat(7,1fr)`, flex: 1, background: "#fff", position: "relative" }}>
        <TimeGutter />
        {days.map((d, di) => {
          const dayEvts = eventsForDay(d);
          return (
            <div key={di} style={{ borderLeft: "1px solid #f3f4f6", position: "relative", height: GRID_H }}
              onClick={e => {
                const rect = e.currentTarget.getBoundingClientRect();
                const y    = e.clientY - rect.top;
                const hour = START_H + Math.floor(y / HOUR_H);
                const min  = Math.round((y % HOUR_H) / HOUR_H * 60 / 15) * 15;
                const nd   = new Date(d); nd.setHours(hour, min, 0); onSelectDate(nd);
              }}
            >
              <HourLines />
              {/* Ligne actuelle */}
              {sameDay(d, today) && <NowLine />}
              {/* Événements */}
              {dayEvts.map(e => {
                const s = parseLocal(e.start);
                const en = parseLocal(e.end);
                const top = topPx(s);
                const height = heightPx(s, en);
                return (
                  <EventBlock key={e.id} event={e} onSelectEvent={onSelectEvent} style={{
                    position: "absolute",
                    top,
                    left: 2,
                    right: 2,
                    height,
                    zIndex: 5,
                  }} />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Day view ───────────────────────────────────────────────── */

function DayView({ currentDate, events, onSelectDate, onSelectEvent }: Omit<Props, "view">) {
  const today   = new Date();
  const dayEvts = events.filter(e => e.start.includes("T") && sameDay(parseLocal(e.start), currentDate));
  const allDay  = events.filter(e => !e.start.includes("T") && sameDay(parseLocal(e.start), currentDate));

  return (
    <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "8px 16px", flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#111827" }}>
          {currentDate.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
          {sameDay(currentDate, today) && <span style={{ marginLeft: 8, background: "#B8966A", color: "#fff", borderRadius: 12, padding: "1px 8px", fontSize: 11 }}>Aujourd'hui</span>}
        </div>
        {allDay.length > 0 && (
          <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
            {allDay.map(e => (
              <div key={e.id} onClick={() => onSelectEvent(e)} style={{ fontSize: 11, background: e.color, color: "#fff", borderRadius: 4, padding: "2px 8px", cursor: "pointer" }}>{e.title}</div>
            ))}
          </div>
        )}
      </div>

      {/* Grille */}
      <div style={{ display: "flex", flex: 1, background: "#fff", overflow: "auto" }}>
        <TimeGutter />
        <div style={{ flex: 1, position: "relative", height: GRID_H, borderLeft: "1px solid #e5e7eb" }}
          onClick={e => {
            const rect = e.currentTarget.getBoundingClientRect();
            const y    = e.clientY - rect.top;
            const hour = Math.floor(y / HOUR_H);
            const min  = Math.round((y % HOUR_H) / HOUR_H * 60 / 15) * 15;
            const nd   = new Date(currentDate); nd.setHours(hour, min, 0); onSelectDate(nd);
          }}
        >
          <HourLines />
          {sameDay(currentDate, today) && <NowLine />}
          {dayEvts.map(e => {
            const s  = parseLocal(e.start);
            const en = parseLocal(e.end);
            return (
              <EventBlock key={e.id} event={e} onSelectEvent={onSelectEvent} style={{
                position: "absolute",
                top:    topPx(s),
                left:   4,
                right:  4,
                height: heightPx(s, en),
                zIndex: 5,
              }} />
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Current time line ──────────────────────────────────────── */

function NowLine() {
  const now = new Date();
  const h = now.getHours();
  if (h < START_H || h >= END_H) return null; // hors plage 8h-20h
  const top = topPx(now);
  return (
    <div style={{ position: "absolute", top, left: 0, right: 0, zIndex: 10, display: "flex", alignItems: "center", pointerEvents: "none" }}>
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#dc2626", marginLeft: -4, flexShrink: 0 }} />
      <div style={{ flex: 1, height: 1.5, background: "#dc2626" }} />
    </div>
  );
}
