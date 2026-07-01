"use client";
import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";

const GOLD = "#B8966A"; const DARK = "#1C1A17"; const BORDER = "#E6E1D9"; const BLUE = "#2563EB"; const RED = "#DC2626"; const GOLD_BG = "#F7F0E6";

type Category = "gestion" | "syndic" | "transaction" | "divers";
interface Item { title: string; summary: string; link: string; date: string; category: Category }
interface Source { id: string; label: string; url: string; items: Item[] | null; lastFetchedAt: string | null; lastError: string | null }
interface Row extends Item { sourceLabel: string; ts: number }

const CATS: { key: Category; label: string; color: string }[] = [
  { key: "gestion", label: "Gestion", color: "#2563EB" },
  { key: "syndic", label: "Syndic", color: "#7C3AED" },
  { key: "transaction", label: "Transaction", color: "#059669" },
  { key: "divers", label: "Divers", color: "#B8966A" },
];
const catColor = (c: Category) => CATS.find(x => x.key === c)?.color ?? GOLD;
const catLabel = (c: Category) => CATS.find(x => x.key === c)?.label ?? "Divers";

const inp: React.CSSProperties = { padding: "8px 11px", border: `1px solid ${BORDER}`, borderRadius: 9, fontSize: 13, boxSizing: "border-box", outline: "none" };

export default function ActualitePage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Category | "tous">("tous");
  const [query, setQuery] = useState("");
  const [label, setLabel] = useState(""); const [url, setUrl] = useState(""); const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const d = await fetch("/api/actualite").then(r => r.json());
      setSources((d.sources ?? []).map((s: Source) => ({ ...s, items: typeof s.items === "string" ? JSON.parse(s.items as unknown as string) : s.items })));
      setCanManage(!!d.canManage);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function addSource() {
    if (!label.trim() || !/^https?:\/\//i.test(url.trim())) { alert("Indiquez un nom et une URL de site (http…)."); return; }
    setBusy(true);
    const r = await fetch("/api/actualite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: label.trim(), url: url.trim() }) });
    setBusy(false);
    if (!r.ok) { const j = await r.json().catch(() => ({})); alert(j.error || "Ajout impossible"); return; }
    setLabel(""); setUrl(""); load(); setTimeout(load, 5000);
  }
  async function refresh(id: string) {
    setRefreshing(id);
    await fetch("/api/actualite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh: id }) }).catch(() => {});
    setRefreshing(null); load();
  }
  async function delSource(id: string) {
    if (!confirm("Supprimer ce site des sources d'actualité ?")) return;
    await fetch(`/api/actualite?id=${id}`, { method: "DELETE" }); load();
  }

  // Agrégation chronologique de tous les articles.
  const ql = query.trim().toLowerCase();
  const rows: Row[] = [];
  for (const s of sources) for (const it of (s.items ?? [])) {
    if (filter !== "tous" && it.category !== filter) continue;
    if (ql && !`${it.title} ${it.summary}`.toLowerCase().includes(ql)) continue;
    rows.push({ ...it, sourceLabel: s.label, ts: Date.parse(it.date || "") || 0 });
  }
  rows.sort((a, b) => b.ts - a.ts);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#FAF8F5" }}>
      <Sidebar active="actualite" />
      <main style={{ flex: 1, padding: "28px 32px", maxWidth: 1120, margin: "0 auto", width: "100%" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: DARK, margin: 0 }}>📰 Actualité immobilière</h1>
        <p style={{ color: "#6b7280", fontSize: 13, marginTop: 4, marginBottom: 18 }}>
          Les articles des sites et flux RSS référencés, résumés et classés par Auguste (gestion, syndic, transaction, divers).
          {canManage ? " Vous pouvez ajouter un site web ou un flux RSS ci-dessous (un flux RSS donne les meilleurs résultats)." : " Consultation et analyse."}
        </p>

        {/* Gestion des sources (admin uniquement) */}
        {canManage && (
          <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16, marginBottom: 18 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: DARK, marginBottom: 10 }}>🛠 Sites référencés (administration)</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: sources.length ? 12 : 0 }}>
              <input value={label} onChange={e => setLabel(e.target.value)} placeholder="Nom du site (ex. Le Figaro Immobilier)" style={{ ...inp, flex: "1 1 220px" }} />
              <input value={url} onChange={e => setUrl(e.target.value)} placeholder="URL du site OU du flux RSS (https://…)" style={{ ...inp, flex: "2 1 300px" }} />
              <button onClick={addSource} disabled={busy} style={{ background: GOLD, color: "#fff", border: "none", borderRadius: 9, padding: "8px 16px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>{busy ? "Ajout…" : "+ Ajouter"}</button>
            </div>
            {sources.map(s => (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderTop: `1px solid ${BORDER}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: DARK }}>{s.label}</div>
                  <div style={{ fontSize: 11, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.url} · {s.items?.length ?? 0} article(s){s.lastError ? " · ⚠️ " + s.lastError : ""}
                  </div>
                </div>
                <button onClick={() => refresh(s.id)} disabled={refreshing === s.id} style={{ background: GOLD_BG, color: GOLD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{refreshing === s.id ? "⏳" : "🔄"}</button>
                <button onClick={() => delSource(s.id)} title="Supprimer" style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "5px 8px", fontSize: 12, color: RED, cursor: "pointer" }}>🗑</button>
              </div>
            ))}
          </div>
        )}

        {/* Filtres par sujet */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {(["tous", ...CATS.map(c => c.key)] as (Category | "tous")[]).map(k => {
            const on = filter === k;
            const col = k === "tous" ? DARK : catColor(k as Category);
            return (
              <button key={k} onClick={() => setFilter(k)}
                style={{ background: on ? col : "#fff", color: on ? "#fff" : col, border: `1px solid ${on ? col : BORDER}`, borderRadius: 999, padding: "5px 14px", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                {k === "tous" ? "Tous" : catLabel(k as Category)}
              </button>
            );
          })}
        </div>

        {/* Recherche */}
        <div style={{ position: "relative", marginBottom: 16 }}>
          <span style={{ position: "absolute", left: 12, top: 10, color: "#9ca3af", fontSize: 14 }}>🔎</span>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher un article…" style={{ ...inp, width: "100%", paddingLeft: 34 }} />
        </div>

        {loading ? (
          <p style={{ color: "#9ca3af", fontSize: 13 }}>Chargement…</p>
        ) : rows.length === 0 ? (
          <p style={{ color: "#9ca3af", fontSize: 13 }}>
            {sources.length === 0 ? (canManage ? "Aucun site référencé. Ajoutez-en un ci-dessus." : "Aucune actualité pour le moment.") : "Aucun article pour ce filtre."}
          </p>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", gap: 14 }}>
            {rows.slice(0, 120).map((r, i) => (
              <a key={i} href={r.link || "#"} target="_blank" rel="noreferrer"
                style={{ display: "flex", flexDirection: "column", background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, overflow: "hidden", textDecoration: "none", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", transition: "transform .15s, box-shadow .15s" }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 8px 22px rgba(0,0,0,0.10)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)"; }}>
                {/* Bandeau couleur de sujet */}
                <div style={{ height: 5, background: catColor(r.category) }} />
                <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <span style={{ fontSize: 10, fontWeight: 800, color: "#fff", background: catColor(r.category), borderRadius: 6, padding: "3px 9px", textTransform: "uppercase", letterSpacing: ".03em" }}>{catLabel(r.category)}</span>
                    {r.ts > 0 && <span style={{ fontSize: 11, color: "#9ca3af", flexShrink: 0 }}>{new Date(r.ts).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}</span>}
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: DARK, lineHeight: 1.35, marginBottom: 8, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{r.title}</div>
                  {r.summary && <div style={{ fontSize: 12.5, color: "#6b7280", lineHeight: 1.55, display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{r.summary}</div>}
                  <div style={{ marginTop: "auto", paddingTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: GOLD, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.sourceLabel}</span>
                    <span style={{ fontSize: 11.5, color: BLUE, fontWeight: 600, flexShrink: 0 }}>Lire →</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
