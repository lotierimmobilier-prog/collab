"use client";
import { useEffect, useMemo, useState } from "react";
import { PERF_TYPES, perfTypeMeta, quarterKey, quarterLabel } from "@/lib/performance";

const GOLD = "#B8966A"; const GOLD_BG = "#F7F0E6"; const BORDER = "#E6E1D9";

interface SimpleUser { id: string; prenom: string; nom: string; roleId?: string; active?: boolean }
interface Entry { id: string; userId: string; type: string; label: string | null; amount: number | null; date: string; createdAt: string }

function todayISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; }

// Liste des 8 derniers trimestres (clé + label) pour le sélecteur
function recentQuarters(): { key: string; label: string }[] {
  const out: { key: string; label: string }[] = [];
  const d = new Date();
  for (let i = 0; i < 8; i++) {
    const ref = new Date(d.getFullYear(), d.getMonth() - i * 3, 1);
    const q = Math.floor(ref.getMonth() / 3) + 1;
    out.push({ key: quarterKey(ref), label: quarterLabel(ref.getFullYear(), q) });
  }
  return out;
}

export default function PerformanceAdmin() {
  const quarters = useMemo(recentQuarters, []);
  const [quarter, setQuarter] = useState(quarters[0].key);
  const [users, setUsers]     = useState<SimpleUser[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState("");

  const [form, setForm] = useState({ userId: "", type: "vente", date: todayISO(), label: "", amount: "" });

  useEffect(() => {
    fetch("/api/users").then(r => r.json())
      .then((us: SimpleUser[]) => setUsers((Array.isArray(us) ? us : []).filter(u => u.active !== false)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/admin/performance?quarter=${quarter}`).then(r => r.json())
      .then(d => setEntries(d.entries ?? [])).catch(() => setEntries([])).finally(() => setLoading(false));
  }, [quarter]);

  const userName = (id: string) => { const u = users.find(x => x.id === id); return u ? `${u.prenom} ${u.nom}` : "—"; };

  async function add() {
    setErr("");
    if (!form.userId) { setErr("Sélectionnez un agent."); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/performance", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || "Erreur"); return; }
      // Recharge si l'entrée tombe dans le trimestre affiché, sinon bascule dessus
      const qk = quarterKey(new Date(form.date));
      if (qk === quarter) setEntries(p => [data, ...p]);
      else setQuarter(qk);
      setForm(f => ({ ...f, label: "", amount: "" }));
    } finally { setSaving(false); }
  }

  async function remove(id: string) {
    await fetch(`/api/admin/performance?id=${id}`, { method: "DELETE" });
    setEntries(p => p.filter(e => e.id !== id));
  }

  // Récapitulatif par agent pour le trimestre affiché
  const byUser = useMemo(() => {
    const map = new Map<string, Record<string, number>>();
    for (const e of entries) {
      if (!map.has(e.userId)) map.set(e.userId, {});
      const r = map.get(e.userId)!;
      r[e.type] = (r[e.type] ?? 0) + 1;
      r.total = (r.total ?? 0) + 1;
      r.ca = (r.ca ?? 0) + (e.amount ?? 0);
    }
    return [...map.entries()].sort((a, b) => (b[1].total ?? 0) - (a[1].total ?? 0));
  }, [entries]);
  const fmtEuro = (n: number) => n ? `${n.toLocaleString("fr-FR")} €` : "—";

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 24, background: "#F3F1EC" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", flexDirection: "column", gap: 18 }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: 0 }}>Performances commerciales</h1>
            <p style={{ fontSize: 13, color: "#6b7280", margin: "4px 0 0" }}>
              Saisissez ici les opérations réalisées. Elles alimentent le classement du trimestre affiché aux commerciaux.
            </p>
          </div>
          <select value={quarter} onChange={e => setQuarter(e.target.value)}
            style={{ height: 38, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "0 12px", fontSize: 14, background: "#fff", fontWeight: 600, color: GOLD }}>
            {quarters.map(q => <option key={q.key} value={q.key}>{q.label}</option>)}
          </select>
        </div>

        {/* Formulaire de saisie */}
        <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${BORDER}`, padding: 18 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#111827", marginBottom: 12 }}>Nouvelle opération</div>
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1.2fr 1fr 1.4fr 0.9fr auto", gap: 10, alignItems: "end" }}>
            <Field label="Agent">
              <select value={form.userId} onChange={e => setForm(f => ({ ...f, userId: e.target.value }))} style={inp}>
                <option value="">— Choisir —</option>
                {users.map(u => <option key={u.id} value={u.id}>{u.prenom} {u.nom}</option>)}
              </select>
            </Field>
            <Field label="Type">
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={inp}>
                {PERF_TYPES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="Date">
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inp} />
            </Field>
            <Field label="Bien / référence (option.)">
              <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="12 rue… / réf." style={inp} />
            </Field>
            <Field label="CA / honoraires € (opt.)">
              <input type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" style={inp} />
            </Field>
            <button onClick={add} disabled={saving}
              style={{ height: 38, background: GOLD, color: "#fff", border: "none", borderRadius: 8, padding: "0 18px", fontSize: 14, fontWeight: 600, cursor: saving ? "default" : "pointer", whiteSpace: "nowrap" }}>
              {saving ? "…" : "+ Ajouter"}
            </button>
          </div>
          {err && <div style={{ marginTop: 8, fontSize: 12, color: "#DC2626" }}>{err}</div>}
        </div>

        {/* Récapitulatif par agent */}
        <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
          <div style={{ padding: "12px 18px", borderBottom: `1px solid #f3f4f6`, fontSize: 13, fontWeight: 700, color: "#111827" }}>
            Récapitulatif — {quarters.find(q => q.key === quarter)?.label}
          </div>
          {byUser.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>Aucune opération sur ce trimestre.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#FAFAF8", color: "#6b7280", fontSize: 11, textTransform: "uppercase" }}>
                  <th style={{ ...th, textAlign: "left" }}>Agent</th>
                  {PERF_TYPES.map(t => <th key={t.id} style={th}>{t.short}</th>)}
                  <th style={th}>Mandats</th>
                  <th style={th}>CA</th>
                </tr>
              </thead>
              <tbody>
                {byUser.map(([uid, r], i) => (
                  <tr key={uid} style={{ borderTop: "1px solid #f3f4f6", background: i === 0 ? GOLD_BG : "#fff" }}>
                    <td style={{ ...td, textAlign: "left", fontWeight: 600 }}>{i === 0 ? "🥇 " : i === 1 ? "🥈 " : i === 2 ? "🥉 " : ""}{userName(uid)}</td>
                    {PERF_TYPES.map(t => <td key={t.id} style={td}>{r[t.id] ?? 0}</td>)}
                    <td style={{ ...td, fontWeight: 700, color: GOLD }}>{r.total ?? 0}</td>
                    <td style={{ ...td, fontWeight: 600 }}>{fmtEuro(r.ca ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Détail des opérations */}
        <div style={{ background: "#fff", borderRadius: 14, border: `1px solid ${BORDER}`, overflow: "hidden" }}>
          <div style={{ padding: "12px 18px", borderBottom: `1px solid #f3f4f6`, fontSize: 13, fontWeight: 700, color: "#111827" }}>
            Détail des opérations {loading ? "…" : `(${entries.length})`}
          </div>
          {entries.length === 0 && !loading ? (
            <div style={{ padding: 20, textAlign: "center", color: "#9ca3af", fontSize: 13 }}>Aucune entrée.</div>
          ) : (
            <div>
              {entries.map(e => {
                const meta = perfTypeMeta(e.type);
                return (
                  <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 18px", borderTop: "1px solid #f3f4f6" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: meta?.color ?? "#374151", background: (meta?.color ?? "#374151") + "18", borderRadius: 5, padding: "2px 8px", whiteSpace: "nowrap" }}>
                      {meta?.icon} {meta?.short ?? e.type}
                    </span>
                    <span style={{ fontWeight: 600, color: "#111827", minWidth: 140 }}>{userName(e.userId)}</span>
                    <span style={{ flex: 1, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.label || "—"}</span>
                    {e.amount != null && <span style={{ color: "#374151", fontWeight: 600 }}>{e.amount.toLocaleString("fr-FR")} €</span>}
                    <span style={{ color: "#9ca3af", fontSize: 12, whiteSpace: "nowrap" }}>{new Date(e.date).toLocaleDateString("fr-FR")}</span>
                    <button onClick={() => remove(e.id)} title="Supprimer" style={{ background: "none", border: "none", cursor: "pointer", color: "#d1d5db", fontSize: 16 }}>×</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
      <label style={{ fontSize: 10, fontWeight: 600, color: "#9ca3af", textTransform: "uppercase" }}>{label}</label>
      {children}
    </div>
  );
}

const inp: React.CSSProperties = { height: 38, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "0 10px", fontSize: 13, outline: "none", background: "#fff", width: "100%", boxSizing: "border-box" };
const th: React.CSSProperties = { padding: "8px 10px", textAlign: "center", fontWeight: 700 };
const td: React.CSSProperties = { padding: "9px 10px", textAlign: "center", color: "#374151" };
