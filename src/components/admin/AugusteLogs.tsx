"use client";
import { useEffect, useState, useCallback } from "react";

const GOLD = "#B8966A"; const DARK = "#1C1A17"; const BORDER = "#E6E1D9";

interface Log {
  id: string; userId: string; userName: string;
  question: string; reply: string | null; tools: string[]; createdAt: string;
}

const TOOL_LABEL: Record<string, string> = {
  get_tasks: "Tâches", create_task: "Créer tâche", update_task: "Modifier tâche",
  get_calendar_events: "Agenda", create_calendar_event: "Créer RDV", update_calendar_event: "Modifier RDV",
  get_users: "Utilisateurs", get_task_families: "Familles", get_notifications: "Notifications",
  get_channels: "Conversations", send_internal_message: "Message interne",
};

export default function AugusteLogs() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const r = await fetch(`/api/admin/auguste-logs?q=${encodeURIComponent(q.trim())}`);
      if (r.status === 403) { setError("Réservé aux administrateurs."); setLogs([]); return; }
      const d = await r.json();
      setLogs(d.logs ?? []);
    } catch { setError("Erreur de chargement."); }
    finally { setLoading(false); }
  }, [q]);

  useEffect(() => { const t = setTimeout(load, 200); return () => clearTimeout(t); }, [load]);

  function fmt(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString("fr-FR") + " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <div style={{ maxWidth: 900 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: DARK, marginBottom: 4 }}>Historique des demandes à Auguste</h2>
      <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 20 }}>Journal des questions posées à l&apos;assistant IA par les utilisateurs.</p>

      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Rechercher (utilisateur, question, réponse)…"
        style={{ width: "100%", height: 38, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "0 12px", fontSize: 13, outline: "none", background: "#fff", marginBottom: 16, boxSizing: "border-box" }} />

      {error && <div style={{ color: "#dc2626", fontSize: 13, padding: "12px 0" }}>{error}</div>}
      {loading && <div style={{ color: "#9ca3af", fontSize: 13, padding: 20, textAlign: "center" }}>Chargement…</div>}
      {!loading && !error && logs.length === 0 && (
        <div style={{ color: "#9ca3af", fontSize: 13, padding: 30, textAlign: "center", background: "#fff", borderRadius: 12, border: `1px solid ${BORDER}` }}>
          Aucune demande enregistrée pour l&apos;instant.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {logs.map(l => (
          <div key={l.id} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, overflow: "hidden" }}>
            <div onClick={() => setOpen(o => o === l.id ? null : l.id)} style={{ padding: "12px 14px", cursor: "pointer", display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: GOLD + "1A", color: GOLD, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                {(l.userName || "?").slice(0, 1).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: DARK }}>{l.userName}</span>
                  <span style={{ fontSize: 11, color: "#9ca3af" }}>{fmt(l.createdAt)}</span>
                </div>
                <div style={{ fontSize: 13, color: "#374151", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: open === l.id ? "normal" : "nowrap" }}>{l.question}</div>
                {l.tools.length > 0 && (
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6 }}>
                    {[...new Set(l.tools)].map(t => (
                      <span key={t} style={{ fontSize: 10, background: "#EFF6FF", color: "#2563EB", borderRadius: 5, padding: "1px 7px", fontWeight: 600 }}>{TOOL_LABEL[t] ?? t}</span>
                    ))}
                  </div>
                )}
              </div>
              <span style={{ color: "#9ca3af", fontSize: 12, flexShrink: 0 }}>{open === l.id ? "▲" : "▼"}</span>
            </div>
            {open === l.id && l.reply && (
              <div style={{ padding: "0 14px 14px 60px", fontSize: 12.5, color: "#4b5563", whiteSpace: "pre-wrap", lineHeight: 1.6, borderTop: `1px solid #f3f4f6` }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: GOLD, textTransform: "uppercase", letterSpacing: "0.05em", margin: "10px 0 4px" }}>Réponse d&apos;Auguste</div>
                {l.reply}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
