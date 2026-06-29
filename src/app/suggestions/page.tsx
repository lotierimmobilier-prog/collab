"use client";
import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import Sidebar from "@/components/Sidebar";

const GOLD = "#B8966A"; const DARK = "#1C1A17"; const BORDER = "#E6E1D9"; const GOLD_BG = "#F7F0E6";
const RED = "#DC2626"; const GREEN = "#2F855A"; const BLUE = "#2563EB"; const AMBER = "#B45309";

interface Suggestion {
  id: string; userName: string; title: string; description: string | null;
  category: string | null; status: string; adminNote: string | null;
  createdAt: string; votes: number; hasVoted: boolean; mine: boolean;
}

const STATUS_UI: Record<string, { label: string; color: string; bg: string }> = {
  nouveau:   { label: "Nouveau",    color: "#6b7280", bg: "#f3f4f6" },
  a_l_etude: { label: "À l'étude",  color: AMBER,     bg: "#FEF3C7" },
  planifie:  { label: "Planifié",   color: BLUE,      bg: "#DBEAFE" },
  realise:   { label: "Réalisé",    color: GREEN,     bg: "#DCFCE7" },
  refuse:    { label: "Non retenu", color: RED,       bg: "#FEE2E2" },
};
const CATS: Record<string, { label: string; icon: string }> = {
  fonctionnalite: { label: "Nouvelle fonctionnalité", icon: "✨" },
  amelioration:   { label: "Amélioration",            icon: "🔧" },
  bug:            { label: "Anomalie",                icon: "🐞" },
  autre:          { label: "Autre",                   icon: "💡" },
};
const STATUS_ORDER = ["nouveau", "a_l_etude", "planifie", "realise", "refuse"];

export default function SuggestionsPage() {
  const { data: session } = useSession();
  const role = (session?.user as { roleId?: string })?.roleId ?? "";
  const isDir = ["admin", "dirigeant", "direction"].includes(role);

  const [items, setItems] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("amelioration");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch("/api/suggestions").then(r => r.ok ? r.json() : null)
      .then(d => setItems(d?.suggestions ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const submit = async () => {
    if (title.trim().length < 3 || saving) return;
    setSaving(true);
    const res = await fetch("/api/suggestions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, category, description }),
    }).catch(() => null);
    setSaving(false);
    if (res?.ok) { setTitle(""); setDescription(""); setCategory("amelioration"); setShowForm(false); load(); }
  };

  const vote = async (id: string) => {
    // optimiste
    setItems(p => p.map(s => s.id === id ? { ...s, hasVoted: !s.hasVoted, votes: s.votes + (s.hasVoted ? -1 : 1) } : s));
    await fetch(`/api/suggestions/${id}/vote`, { method: "POST" }).catch(() => {});
  };
  const setStatus = async (id: string, status: string) => {
    setItems(p => p.map(s => s.id === id ? { ...s, status } : s));
    await fetch(`/api/suggestions/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) }).catch(() => {});
  };
  const remove = async (id: string) => {
    if (!confirm("Supprimer cette suggestion ?")) return;
    setItems(p => p.filter(s => s.id !== id));
    await fetch(`/api/suggestions/${id}`, { method: "DELETE" }).catch(() => {});
  };

  const counts = STATUS_ORDER.reduce((a, s) => { a[s] = items.filter(i => i.status === s).length; return a; }, {} as Record<string, number>);
  const shown = filter === "all" ? items : items.filter(i => i.status === filter);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#FAF8F5" }}>
      <Sidebar active="suggestions" />
      <main style={{ flex: 1, padding: "28px 32px", maxWidth: 920, margin: "0 auto", width: "100%" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 6 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: DARK, margin: 0 }}>💡 Idées & améliorations</h1>
          <button onClick={() => setShowForm(v => !v)} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 9, padding: "9px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            {showForm ? "Fermer" : "+ Proposer une idée"}
          </button>
        </div>
        <p style={{ color: "#6b7280", fontSize: 13, marginTop: 0, marginBottom: 18 }}>
          Proposez vos idées pour faire évoluer Collab, et votez pour celles des collègues. L'équipe les étudie et les fait avancer.
        </p>

        {showForm && (
          <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 18, marginBottom: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Votre idée en une phrase…" maxLength={160}
              style={{ width: "100%", padding: "10px 12px", border: `1px solid ${BORDER}`, borderRadius: 9, fontSize: 14, marginBottom: 10, boxSizing: "border-box" }} />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              {Object.entries(CATS).map(([k, v]) => (
                <button key={k} onClick={() => setCategory(k)} style={{
                  background: category === k ? GOLD_BG : "#fff", color: category === k ? GOLD : "#6b7280",
                  border: `1px solid ${category === k ? GOLD : BORDER}`, borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}>{v.icon} {v.label}</button>
              ))}
            </div>
            <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Détaillez (optionnel) : le besoin, l'objectif, un exemple…" rows={4} maxLength={4000}
              style={{ width: "100%", padding: "10px 12px", border: `1px solid ${BORDER}`, borderRadius: 9, fontSize: 13, resize: "vertical", boxSizing: "border-box" }} />
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
              <button onClick={submit} disabled={title.trim().length < 3 || saving} style={{
                background: title.trim().length < 3 ? "#d1d5db" : GOLD, color: "#fff", border: "none", borderRadius: 9,
                padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: title.trim().length < 3 ? "default" : "pointer",
              }}>{saving ? "Envoi…" : "Publier"}</button>
            </div>
          </div>
        )}

        {/* Filtres par statut */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
          <FilterBtn active={filter === "all"} onClick={() => setFilter("all")} label={`Toutes (${items.length})`} />
          {STATUS_ORDER.map(s => (
            <FilterBtn key={s} active={filter === s} onClick={() => setFilter(s)} label={`${STATUS_UI[s].label} (${counts[s] || 0})`} color={STATUS_UI[s].color} />
          ))}
        </div>

        {loading && <div style={{ color: "#9ca3af", fontSize: 13, padding: 24, textAlign: "center" }}>Chargement…</div>}
        {!loading && !shown.length && <div style={{ color: "#9ca3af", fontSize: 13, padding: 24, textAlign: "center" }}>Aucune suggestion ici. Soyez le premier à en proposer une !</div>}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {shown.map(s => {
            const st = STATUS_UI[s.status] || STATUS_UI.nouveau;
            const cat = CATS[s.category || "autre"] || CATS.autre;
            return (
              <div key={s.id} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16, display: "flex", gap: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
                {/* Vote */}
                <button onClick={() => vote(s.id)} title="Voter" style={{
                  flexShrink: 0, width: 52, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
                  background: s.hasVoted ? GOLD_BG : "#fafafa", color: s.hasVoted ? GOLD : "#6b7280",
                  border: `1px solid ${s.hasVoted ? GOLD : BORDER}`, borderRadius: 10, padding: "8px 0", cursor: "pointer",
                }}>
                  <span style={{ fontSize: 14 }}>▲</span>
                  <span style={{ fontSize: 16, fontWeight: 800 }}>{s.votes}</span>
                </button>
                {/* Contenu */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: DARK }}>{s.title}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: st.color, background: st.bg, borderRadius: 7, padding: "2px 8px" }}>{st.label}</span>
                  </div>
                  {s.description && <div style={{ fontSize: 13, color: "#4b5563", marginTop: 6, whiteSpace: "pre-wrap" }}>{s.description}</div>}
                  <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 8, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    <span>{cat.icon} {cat.label}</span>
                    <span>· {s.userName}</span>
                    <span>· {new Date(s.createdAt).toLocaleDateString("fr-FR")}</span>
                  </div>
                  {s.adminNote && (
                    <div style={{ marginTop: 8, background: GOLD_BG, borderLeft: `3px solid ${GOLD}`, borderRadius: 6, padding: "6px 10px", fontSize: 12.5, color: "#4b5563" }}>
                      <b style={{ color: GOLD }}>Réponse de l'équipe :</b> {s.adminNote}
                    </div>
                  )}
                  {/* Actions admin */}
                  {(isDir || s.mine) && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10, alignItems: "center" }}>
                      {isDir && (
                        <select value={s.status} onChange={e => setStatus(s.id, e.target.value)} style={{ fontSize: 12, padding: "4px 8px", border: `1px solid ${BORDER}`, borderRadius: 7, color: DARK, background: "#fff" }}>
                          {STATUS_ORDER.map(k => <option key={k} value={k}>{STATUS_UI[k].label}</option>)}
                        </select>
                      )}
                      <button onClick={() => remove(s.id)} style={{ fontSize: 11.5, color: RED, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Supprimer</button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

function FilterBtn({ active, onClick, label, color }: { active: boolean; onClick: () => void; label: string; color?: string }) {
  return (
    <button onClick={onClick} style={{
      background: active ? (color ?? GOLD) : "#fff", color: active ? "#fff" : (color ?? "#6b7280"),
      border: `1px solid ${active ? (color ?? GOLD) : BORDER}`, borderRadius: 8, padding: "5px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
    }}>{label}</button>
  );
}
