"use client";
import { LocalEvent } from "./PlanningBoard";

const DAYS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

interface Props {
  view: "month" | "week" | "day";
  currentDate: Date;
  events: LocalEvent[];
  onSelectDate: (d: Date) => void;
  onSelectEvent: (e: LocalEvent) => void;
}

interface SubProps {
  currentDate: Date;
  events: LocalEvent[];
  onSelectDate: (d: Date) => void;
  onSelectEvent: (e: LocalEvent) => void;
}

export default function CalendarView({ view, currentDate, events, onSelectDate, onSelectEvent }: Props) {
  if (view === "month") return <MonthView currentDate={currentDate} events={events} onSelectDate={onSelectDate} onSelectEvent={onSelectEvent} />;
  if (view === "week")  return <WeekView  currentDate={currentDate} events={events} onSelectDate={onSelectDate} onSelectEvent={onSelectEvent} />;
  return <DayView currentDate={currentDate} events={events} onSelectDate={onSelectDate} onSelectEvent={onSelectEvent} />;
}

/* ── Month view ─────────────────────────────────────────────── */
function MonthView({ currentDate, events, onSelectDate, onSelectEvent }: SubProps) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const offset = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const cells: (Date | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  function eventsForDay(d: Date) {
    return events.filter(e => {
      const start = new Date(e.start);
      return start.getFullYear() === d.getFullYear() &&
             start.getMonth() === d.getMonth() &&
             start.getDate() === d.getDate();
    }).slice(0, 3);
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "0 0 20px" }}>
      {/* Header */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", background: "#fff", borderBottom: "1px solid #e5e7eb" }}>
        {DAYS_FR.map(d => (
          <div key={d} style={{ textAlign: "center", padding: "8px 0", fontSize: 11, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase" }}>{d}</div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", background: "#fff", flex: 1 }}>
        {cells.map((d, i) => {
          const isToday = d && d.toDateString() === today.toDateString();
          const dayEvents = d ? eventsForDay(d) : [];
          return (
            <div key={i} onClick={() => d && onSelectDate(d)} style={{
              minHeight: 90, padding: "6px 8px",
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
                    fontSize: 12, fontWeight: isToday ? 700 : 400,
                    background: isToday ? "#7c3aed" : "transparent",
                    color: isToday ? "#fff" : d.getDay() === 0 || d.getDay() === 6 ? "#9ca3af" : "#111827",
                    marginBottom: 4,
                  }}>{d.getDate()}</div>
                  {dayEvents.map(e => (
                    <div key={e.id} onClick={ev => { ev.stopPropagation(); onSelectEvent(e); }} style={{
                      fontSize: 10, background: e.color, color: "#fff",
                      borderRadius: 4, padding: "2px 5px", marginBottom: 2,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      cursor: "pointer",
                    }}>{e.title}</div>
                  ))}
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
function WeekView({ currentDate, events, onSelectDate, onSelectEvent }: SubProps) {
  const monday = new Date(currentDate);
  monday.setDate(currentDate.getDate() - (currentDate.getDay() === 0 ? 6 : currentDate.getDay() - 1));
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d; });
  const today = new Date();

  function eventsForDayHour(d: Date, hour: number) {
    return events.filter(e => {
      if (!e.start.includes("T")) return false;
      const s = new Date(e.start);
      return s.getFullYear() === d.getFullYear() && s.getMonth() === d.getMonth() && s.getDate() === d.getDate() && s.getHours() === hour;
    });
  }

  return (
    <div style={{ flex: 1, overflow: "auto" }}>
      <div style={{ display: "grid", gridTemplateColumns: "50px repeat(7,1fr)", background: "#fff", borderBottom: "1px solid #e5e7eb", position: "sticky", top: 0, zIndex: 10 }}>
        <div />
        {days.map((d, i) => {
          const isToday = d.toDateString() === today.toDateString();
          return (
            <div key={i} style={{ textAlign: "center", padding: "8px 4px", borderLeft: "1px solid #f3f4f6" }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase" }}>{DAYS_FR[i]}</div>
              <div style={{
                width: 28, height: 28, borderRadius: "50%", margin: "2px auto 0",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: isToday ? 700 : 400,
                background: isToday ? "#7c3aed" : "transparent",
                color: isToday ? "#fff" : "#111827",
              }}>{d.getDate()}</div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "50px repeat(7,1fr)", background: "#fff" }}>
        {HOURS.map(hour => (
          <>
            <div key={`h${hour}`} style={{ padding: "0 6px", borderBottom: "1px solid #f3f4f6", textAlign: "right" }}>
              <span style={{ fontSize: 10, color: "#9ca3af", position: "relative", top: -6 }}>{hour > 0 ? `${String(hour).padStart(2, "0")}:00` : ""}</span>
            </div>
            {days.map((d, di) => {
              const dayEvts = eventsForDayHour(d, hour);
              return (
                <div key={`d${di}h${hour}`} onClick={() => { const nd = new Date(d); nd.setHours(hour); onSelectDate(nd); }} style={{
                  minHeight: 48, borderLeft: "1px solid #f3f4f6", borderBottom: "1px solid #f3f4f6",
                  padding: "2px 3px", cursor: "pointer", position: "relative",
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#fafafa")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  {dayEvts.map(e => (
                    <div key={e.id} onClick={ev => { ev.stopPropagation(); onSelectEvent(e); }} style={{
                      fontSize: 10, background: e.color, color: "#fff", borderRadius: 4,
                      padding: "2px 5px", marginBottom: 2, cursor: "pointer",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>{e.title}</div>
                  ))}
                </div>
              );
            })}
          </>
        ))}
      </div>
    </div>
  );
}

/* ── Day view ───────────────────────────────────────────────── */
function DayView({ currentDate, events, onSelectDate, onSelectEvent }: SubProps) {
  const dayEvts = events.filter(e => {
    const s = new Date(e.start);
    return s.getFullYear() === currentDate.getFullYear() && s.getMonth() === currentDate.getMonth() && s.getDate() === currentDate.getDate();
  });

  return (
    <div style={{ flex: 1, overflow: "auto", background: "#fff" }}>
      <div style={{ display: "grid", gridTemplateColumns: "60px 1fr" }}>
        {HOURS.map(hour => {
          const hourEvts = dayEvts.filter(e => e.start.includes("T") && new Date(e.start).getHours() === hour);
          return (
            <>
              <div key={`h${hour}`} style={{ padding: "0 8px", borderBottom: "1px solid #f3f4f6", minHeight: 60, display: "flex", alignItems: "flex-start" }}>
                <span style={{ fontSize: 11, color: "#9ca3af", position: "relative", top: -6 }}>{hour > 0 ? `${String(hour).padStart(2, "0")}:00` : ""}</span>
              </div>
              <div key={`e${hour}`} onClick={() => { const d = new Date(currentDate); d.setHours(hour); onSelectDate(d); }} style={{ minHeight: 60, borderBottom: "1px solid #f3f4f6", borderLeft: "1px solid #f3f4f6", padding: "4px 8px", cursor: "pointer" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#fafafa")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >
                {hourEvts.map(e => (
                  <div key={e.id} onClick={ev => { ev.stopPropagation(); onSelectEvent(e); }} style={{
                    background: e.color, color: "#fff", borderRadius: 6,
                    padding: "4px 8px", marginBottom: 4, cursor: "pointer", fontSize: 12, fontWeight: 500,
                  }}>
                    <div>{e.title}</div>
                    {e.location && <div style={{ fontSize: 10, opacity: 0.85 }}>📍 {e.location}</div>}
                  </div>
                ))}
              </div>
            </>
          );
        })}
      </div>
    </div>
  );
}
