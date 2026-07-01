"use client";
import { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import Sidebar from "@/components/Sidebar";
import { nav } from "@/components/Sidebar";

const GOLD = "#B8966A"; const DARK = "#1C1A17"; const BORDER = "#E6E1D9"; const GOLD_BG = "#F7F0E6"; const GREEN = "#2F855A";
const GROUPS = ["Principal", "Drive", "Gestion", "Agence", "Réseaux sociaux", "Personnel"];

interface Row { id: string; label: string; icon: string; defLabel: string; defIcon: string; group: string }

export default function AdminMenuPage() {
  const { data: session } = useSession();
  const isSuper = (session?.user as { superAdmin?: boolean } | undefined)?.superAdmin === true;

  const [rows, setRows] = useState<Row[]>([]);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/menu-custom").then(r => r.json()).then(d => {
      const mc: Record<string, { label?: string; icon?: string; order?: number }> = d.custom ?? {};
      const built: Row[] = GROUPS.flatMap(g =>
        nav.filter(n => n.group === g)
          .map((n, i) => ({ n, i }))
          .sort((a, b) => (mc[a.n.id]?.order ?? a.i) - (mc[b.n.id]?.order ?? b.i))
          .map(({ n }) => ({ id: n.id, group: g, defLabel: n.label, defIcon: n.icon, label: mc[n.id]?.label || n.label, icon: mc[n.id]?.icon || n.icon })),
      );
      setRows(built);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const byGroup = useMemo(() => GROUPS.map(g => ({ group: g, items: rows.filter(r => r.group === g) })).filter(x => x.items.length), [rows]);

  function move(group: string, idx: number, dir: -1 | 1) {
    setRows(prev => {
      const g = prev.filter(r => r.group === group);
      const j = idx + dir;
      if (j < 0 || j >= g.length) return prev;
      [g[idx], g[j]] = [g[j], g[idx]];
      // Recompose en conservant l'ordre des autres groupes.
      const others = prev.filter(r => r.group !== group);
      const out: Row[] = [];
      for (const gr of GROUPS) out.push(...(gr === group ? g : others.filter(r => r.group === gr)));
      return out;
    });
    setSaved(false);
  }
  function edit(id: string, field: "label" | "icon", value: string) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    setSaved(false);
  }

  async function save() {
    const custom: Record<string, { label?: string; icon?: string; order?: number }> = {};
    for (const g of GROUPS) {
      const items = rows.filter(r => r.group === g);
      items.forEach((r, order) => {
        const o: { label?: string; icon?: string; order?: number } = { order };
        if (r.label.trim() && r.label.trim() !== r.defLabel) o.label = r.label.trim();
        if (r.icon.trim() && r.icon.trim() !== r.defIcon) o.icon = r.icon.trim();
        custom[r.id] = o;
      });
    }
    await fetch("/api/menu-custom", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ custom }) });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }
  async function resetAll() {
    if (!confirm("Réinitialiser tout le menu (ordre, libellés, icônes) ?")) return;
    await fetch("/api/menu-custom", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ custom: {} }) });
    location.reload();
  }

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#FAF8F5" }}>
      <Sidebar active="admin-menu" />
      <main style={{ flex: 1, padding: "28px 32px", maxWidth: 820, margin: "0 auto", width: "100%" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: DARK, margin: 0 }}>🧭 Personnalisation du menu</h1>
        <p style={{ color: "#6b7280", fontSize: 13, marginTop: 4, marginBottom: 18 }}>Réorganisez les entrées, changez leurs titres et leurs icônes. Les modifications s’appliquent à toute l’agence.</p>

        {!isSuper ? (
          <div style={{ background: "#FEF3F2", border: "1px solid #FECDCA", borderRadius: 12, padding: 20, color: "#B42318", fontSize: 13.5 }}>Réservé au super administrateur.</div>
        ) : loading ? (
          <p style={{ color: "#9ca3af", fontSize: 13 }}>Chargement…</p>
        ) : (
          <>
            <div style={{ position: "sticky", top: 0, background: "#FAF8F5", padding: "6px 0 12px", display: "flex", gap: 10, alignItems: "center", zIndex: 2 }}>
              <button onClick={save} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 9, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>💾 Enregistrer</button>
              <button onClick={resetAll} style={{ background: "#fff", color: "#6b7280", border: `1px solid ${BORDER}`, borderRadius: 9, padding: "9px 14px", fontSize: 13, cursor: "pointer" }}>Réinitialiser</button>
              {saved && <span style={{ color: GREEN, fontSize: 13, fontWeight: 700 }}>✓ Enregistré</span>}
            </div>

            {byGroup.map(({ group, items }) => (
              <div key={group} style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: GOLD, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>{group}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {items.map((r, i) => (
                    <div key={r.id} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 10, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <button onClick={() => move(group, i, -1)} disabled={i === 0} title="Monter" style={{ border: "none", background: "none", cursor: i === 0 ? "default" : "pointer", color: i === 0 ? "#d1d5db" : "#6b7280", fontSize: 12, lineHeight: 1 }}>▲</button>
                        <button onClick={() => move(group, i, 1)} disabled={i === items.length - 1} title="Descendre" style={{ border: "none", background: "none", cursor: i === items.length - 1 ? "default" : "pointer", color: i === items.length - 1 ? "#d1d5db" : "#6b7280", fontSize: 12, lineHeight: 1 }}>▼</button>
                      </div>
                      <input value={r.icon} onChange={e => edit(r.id, "icon", e.target.value)} title="Icône (emoji ou caractère)" style={{ width: 44, textAlign: "center", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "7px 4px", fontSize: 16 }} />
                      <input value={r.label} onChange={e => edit(r.id, "label", e.target.value)} placeholder={r.defLabel} style={{ flex: 1, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "7px 10px", fontSize: 13 }} />
                      {(r.label !== r.defLabel || r.icon !== r.defIcon) && (
                        <button onClick={() => { edit(r.id, "label", r.defLabel); edit(r.id, "icon", r.defIcon); }} title="Rétablir le défaut" style={{ border: `1px solid ${BORDER}`, background: GOLD_BG, borderRadius: 8, padding: "5px 8px", fontSize: 11, color: GOLD, cursor: "pointer", whiteSpace: "nowrap" }}>↺</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </main>
    </div>
  );
}
