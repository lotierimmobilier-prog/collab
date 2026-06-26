"use client";
import { useEffect, useState } from "react";

const GOLD = "#B8966A"; const DARK = "#1C1A17"; const BORDER = "#E6E1D9"; const GOLD_BG = "#F7F0E6";
const PRIO: Record<string, { label: string; color: string }> = {
  urgent: { label: "Urgente", color: "#9B2C2C" }, haute: { label: "Haute", color: "#D97706" },
  moyenne: { label: "Moyenne", color: "#2563EB" }, basse: { label: "Basse", color: "#6b7280" },
};

interface Proposal {
  title: string; description?: string; priority?: string;
  assigneeId?: string | null; assigneeName?: string | null; dueDate?: string | null; rationale?: string;
}
interface SimpleUser { id: string; name: string }

export default function AugusteAnalysisModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [users, setUsers] = useState<SimpleUser[]>([]);
  const [created, setCreated] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState<number | null>(null);

  async function run() {
    setLoading(true); setError(""); setCreated(new Set());
    try {
      const r = await fetch("/api/ai/analyse-taches", { method: "POST" });
      const d = await r.json();
      if (!r.ok) { setError(d.error || "L'analyse a échoué."); return; }
      setProposals(d.proposals ?? []); setUsers(d.users ?? []);
      if ((d.proposals ?? []).length === 0) setError("Auguste n'a pas de nouvelle tâche à proposer pour le moment.");
    } catch { setError("Erreur réseau pendant l'analyse."); }
    finally { setLoading(false); }
  }
  useEffect(() => { run(); }, []);

  function patch(i: number, key: keyof Proposal, value: string) {
    setProposals(ps => ps.map((p, idx) => idx === i ? { ...p, [key]: value || null } : p));
  }

  async function create(i: number) {
    const p = proposals[i];
    setBusy(i);
    try {
      const r = await fetch("/api/tasks", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: p.title, description: p.description ?? "", priority: p.priority ?? "moyenne",
          assigneeId: p.assigneeId ?? undefined,
          assigneeName: p.assigneeId ? (users.find(u => u.id === p.assigneeId)?.name ?? p.assigneeName) : p.assigneeName ?? undefined,
          dueDate: p.dueDate ?? null,
        }),
      });
      if (r.ok) { setCreated(s => new Set(s).add(i)); onCreated(); }
    } finally { setBusy(null); }
  }

  async function createAll() {
    for (let i = 0; i < proposals.length; i++) if (!created.has(i)) await create(i);
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, width: 640, maxWidth: "96vw", maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
        <div style={{ background: DARK, padding: "13px 18px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>✦ Analyse d&apos;Auguste — tâches proposées</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#9ca3af", fontSize: 22, cursor: "pointer", lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: 18, overflowY: "auto", flex: 1 }}>
          {loading && <div style={{ textAlign: "center", color: "#9ca3af", fontSize: 13, padding: 30 }}>Auguste analyse l&apos;activité de l&apos;agence…</div>}
          {!loading && error && <div style={{ textAlign: "center", color: error.includes("pas de nouvelle") ? "#6b7280" : "#9B2C2C", fontSize: 13, padding: 24 }}>{error}</div>}

          {!loading && proposals.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {proposals.map((p, i) => {
                const pr = PRIO[p.priority ?? "moyenne"] ?? PRIO.moyenne;
                const done = created.has(i);
                return (
                  <div key={i} style={{ border: `1px solid ${BORDER}`, borderRadius: 12, padding: 14, background: done ? GOLD_BG : "#fff", opacity: done ? 0.7 : 1 }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: DARK }}>{p.title}</div>
                        {p.description && <div style={{ fontSize: 12.5, color: "#4b5563", marginTop: 3 }}>{p.description}</div>}
                        {p.rationale && <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 5, fontStyle: "italic" }}>💡 {p.rationale}</div>}
                      </div>
                      <span style={{ background: pr.color + "1A", color: pr.color, borderRadius: 6, padding: "2px 9px", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{pr.label}</span>
                    </div>

                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 10, flexWrap: "wrap" }}>
                      <select value={p.assigneeId ?? ""} onChange={e => patch(i, "assigneeId", e.target.value)} disabled={done} style={inp}>
                        <option value="">— Non assigné —</option>
                        {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                      </select>
                      <select value={p.priority ?? "moyenne"} onChange={e => patch(i, "priority", e.target.value)} disabled={done} style={{ ...inp, width: 120 }}>
                        <option value="urgent">Urgente</option><option value="haute">Haute</option>
                        <option value="moyenne">Moyenne</option><option value="basse">Basse</option>
                      </select>
                      <input type="date" value={p.dueDate ?? ""} onChange={e => patch(i, "dueDate", e.target.value)} disabled={done} style={{ ...inp, width: 150 }} />
                      <div style={{ flex: 1 }} />
                      <button onClick={() => create(i)} disabled={done || busy === i}
                        style={{ background: done ? "#2F6B46" : GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "7px 14px", fontSize: 12.5, fontWeight: 600, cursor: done ? "default" : "pointer", whiteSpace: "nowrap" }}>
                        {done ? "✓ Créée" : busy === i ? "…" : "Créer la tâche"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {!loading && proposals.length > 0 && (
          <div style={{ borderTop: `1px solid ${BORDER}`, padding: "12px 18px", display: "flex", gap: 10, justifyContent: "space-between", alignItems: "center" }}>
            <button onClick={run} style={{ background: "#fff", color: "#374151", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>↻ Relancer</button>
            <button onClick={createAll} disabled={created.size === proposals.length}
              style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 600, cursor: created.size === proposals.length ? "default" : "pointer", opacity: created.size === proposals.length ? 0.5 : 1 }}>
              Tout créer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const inp: React.CSSProperties = { height: 34, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "0 8px", fontSize: 12.5, outline: "none", background: "#f9fafb", fontFamily: "inherit" };
