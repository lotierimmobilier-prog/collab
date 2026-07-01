"use client";
import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import Markdown from "@/components/Markdown";

const GOLD = "#B8966A"; const DARK = "#1C1A17"; const BORDER = "#E6E1D9"; const GOLD_BG = "#F7F0E6";
const BLUE = "#2563EB"; const RED = "#DC2626"; const GREEN = "#2F855A";

interface Family { id: string; name: string; color: string | null }
interface Item { title: string; link: string; date: string; summary: string }
interface Feed {
  id: string; familyId: string | null; title: string; url: string;
  analysis: string | null; items: Item[] | null; lastAnalyzedAt: string | null; lastError: string | null;
}

const COLORS = ["#B8966A", "#2563EB", "#059669", "#7C3AED", "#DC2626", "#D97706", "#0891B2"];
const inp: React.CSSProperties = { padding: "8px 11px", border: `1px solid ${BORDER}`, borderRadius: 9, fontSize: 13, boxSizing: "border-box", outline: "none" };
const btn = (bg: string): React.CSSProperties => ({ background: bg, color: "#fff", border: "none", borderRadius: 9, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" });

function ago(iso: string | null): string {
  if (!iso) return "jamais analysé";
  const d = Date.now() - new Date(iso).getTime();
  const h = Math.floor(d / 3600000);
  if (h < 1) return "il y a moins d'une heure";
  if (h < 24) return `il y a ${h} h`;
  return `il y a ${Math.floor(h / 24)} j`;
}

export default function VeilleJuridiquePage() {
  const [families, setFamilies] = useState<Family[]>([]);
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState<string | null>(null);

  const [fTitle, setFTitle] = useState(""); const [fUrl, setFUrl] = useState(""); const [fFamily, setFFamily] = useState("");
  const [famName, setFamName] = useState(""); const [famColor, setFamColor] = useState(COLORS[0]);
  const [showFam, setShowFam] = useState(false);
  const [query, setQuery] = useState("");            // moteur de recherche
  const [open, setOpen] = useState<Set<string>>(new Set()); // flux dépliés
  const toggle = (id: string) => setOpen(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const load = useCallback(async () => {
    try {
      const d = await fetch("/api/veille").then(r => r.json());
      setFamilies(d.families ?? []);
      setFeeds((d.feeds ?? []).map((f: Feed) => ({ ...f, items: typeof f.items === "string" ? JSON.parse(f.items) : f.items })));
    } catch { /* ignore */ }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function addFamily() {
    if (!famName.trim()) return;
    await fetch("/api/veille", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "family", name: famName.trim(), color: famColor }) });
    setFamName(""); setShowFam(false); load();
  }
  async function addFeed() {
    if (!fTitle.trim() || !/^https?:\/\//i.test(fUrl.trim())) { alert("Indiquez un titre et une URL de flux (http…)."); return; }
    await fetch("/api/veille", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: "feed", title: fTitle.trim(), url: fUrl.trim(), familyId: fFamily || null }) });
    setFTitle(""); setFUrl(""); setFFamily("");
    // L'analyse initiale tourne en tâche de fond ; on recharge après un court délai.
    load(); setTimeout(load, 4000);
  }
  async function refreshFeed(id: string) {
    setRefreshing(id);
    await fetch("/api/veille/refresh", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ feedId: id }) }).catch(() => {});
    setRefreshing(null); load();
  }
  async function delFeed(id: string) { if (!confirm("Supprimer ce flux ?")) return; await fetch(`/api/veille?kind=feed&id=${id}`, { method: "DELETE" }); load(); }
  async function delFamily(id: string) { if (!confirm("Supprimer cette famille ? Les flux seront conservés (sans famille).")) return; await fetch(`/api/veille?kind=family&id=${id}`, { method: "DELETE" }); load(); }

  const groups: { fam: Family | null; feeds: Feed[] }[] = [
    ...families.map(fam => ({ fam, feeds: feeds.filter(f => f.familyId === fam.id) })),
    { fam: null, feeds: feeds.filter(f => !f.familyId || !families.find(x => x.id === f.familyId)) },
  ].filter(g => g.fam || g.feeds.length);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#FAF8F5" }}>
      <Sidebar active="veille" />
      <main style={{ flex: 1, padding: "28px 32px", maxWidth: 1000, margin: "0 auto", width: "100%" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: DARK, margin: 0 }}>⚖️ Veille juridique</h1>
        <p style={{ color: "#6b7280", fontSize: 13, marginTop: 4, marginBottom: 20 }}>
          Ajoutez un flux RSS <strong>ou l&apos;adresse d&apos;un site web</strong> : Auguste récupère les articles (titre, résumé, lien) et les analyse automatiquement toutes les 24 h et à chaque ajout. Visible par toute l&apos;équipe.
        </p>

        {/* Ajout d'un flux */}
        <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16, marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.05)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr auto auto", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <input value={fTitle} onChange={e => setFTitle(e.target.value)} placeholder="Titre du flux (ex. Légifrance – Immobilier)" style={inp} />
            <input value={fUrl} onChange={e => setFUrl(e.target.value)} placeholder="URL d'un flux RSS ou d'un site web (https://…)" style={inp} />
            <select value={fFamily} onChange={e => setFFamily(e.target.value)} style={{ ...inp, cursor: "pointer" }}>
              <option value="">Sans famille</option>
              {families.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <button onClick={addFeed} style={btn(GOLD)}>+ Ajouter le flux</button>
          </div>
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            {!showFam ? (
              <button onClick={() => setShowFam(true)} style={{ background: GOLD_BG, color: GOLD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ Nouvelle famille</button>
            ) : (
              <>
                <input value={famName} onChange={e => setFamName(e.target.value)} placeholder="Nom de la famille" style={{ ...inp, width: 220 }} />
                <div style={{ display: "flex", gap: 4 }}>
                  {COLORS.map(c => <button key={c} onClick={() => setFamColor(c)} style={{ width: 22, height: 22, borderRadius: "50%", background: c, border: famColor === c ? "2px solid #111" : "2px solid #fff", cursor: "pointer" }} />)}
                </div>
                <button onClick={addFamily} style={btn(GREEN)}>Créer</button>
                <button onClick={() => setShowFam(false)} style={{ background: "none", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: 13 }}>Annuler</button>
              </>
            )}
          </div>
        </div>

        {/* Moteur de recherche */}
        <div style={{ marginBottom: 16, position: "relative" }}>
          <span style={{ position: "absolute", left: 12, top: 10, color: "#9ca3af", fontSize: 14 }}>🔎</span>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher un article, un flux…" style={{ ...inp, width: "100%", paddingLeft: 34 }} />
        </div>

        {(() => {
          const ql = query.trim().toLowerCase();
          const hay = (f: Feed) => `${f.title} ${f.url} ${f.analysis ?? ""} ${(f.items ?? []).map(it => `${it.title} ${it.summary}`).join(" ")}`.toLowerCase();
          const itemHit = (it: Item) => !ql || `${it.title} ${it.summary}`.toLowerCase().includes(ql);
          const visGroups = groups
            .map(g => ({ ...g, feeds: g.feeds.filter(f => !ql || hay(f).includes(ql)) }))
            .filter(g => g.feeds.length > 0);

          if (loading) return <p style={{ color: "#9ca3af", fontSize: 13 }}>Chargement…</p>;
          if (visGroups.length === 0) return <p style={{ color: "#9ca3af", fontSize: 13 }}>{ql ? "Aucun résultat pour cette recherche." : "Aucun flux pour le moment. Ajoutez votre premier flux ci-dessus."}</p>;

          return visGroups.map((g, gi) => (
          <div key={g.fam?.id ?? `none-${gi}`} style={{ marginBottom: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: g.fam?.color ?? "#9ca3af" }} />
              <h2 style={{ fontSize: 15, fontWeight: 800, color: DARK, margin: 0 }}>{g.fam?.name ?? "Sans famille"}</h2>
              {g.fam && <button onClick={() => delFamily(g.fam!.id)} title="Supprimer la famille" style={{ background: "none", border: "none", color: "#d1d5db", cursor: "pointer", fontSize: 13 }}>🗑</button>}
            </div>
            {g.feeds.map(f => {
              const isOpen = open.has(f.id) || !!ql;   // recherche active → tout déplié
              return (
              <div key={f.id} style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, marginBottom: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.04)", overflow: "hidden" }}>
                {/* En-tête cliquable : ouvre / réduit le flux */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, padding: 14, cursor: "pointer" }} onClick={() => toggle(f.id)}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <span style={{ fontSize: 12, color: GOLD, transition: "transform .2s", transform: isOpen ? "rotate(90deg)" : "none" }}>▶</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: DARK }}>{f.title}</div>
                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 1 }}>Analysé {ago(f.lastAnalyzedAt)}{f.items?.length ? ` · ${f.items.length} article(s)` : ""}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button onClick={e => { e.stopPropagation(); refreshFeed(f.id); }} disabled={refreshing === f.id} style={{ background: GOLD_BG, color: GOLD, border: `1px solid ${BORDER}`, borderRadius: 8, padding: "5px 10px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>{refreshing === f.id ? "⏳ Analyse…" : "🔄 Analyser"}</button>
                    <button onClick={e => { e.stopPropagation(); delFeed(f.id); }} title="Supprimer" style={{ background: "none", border: `1px solid ${BORDER}`, borderRadius: 8, padding: "5px 8px", fontSize: 12, color: RED, cursor: "pointer" }}>🗑</button>
                  </div>
                </div>

                {isOpen && (
                  <div style={{ padding: "0 16px 16px", borderTop: `1px solid ${BORDER}` }}>
                    <a href={f.url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ display: "inline-block", marginTop: 12, fontSize: 11, color: BLUE, textDecoration: "none", wordBreak: "break-all" }}>{f.url}</a>
                    {f.lastError && <div style={{ marginTop: 10, fontSize: 12, color: "#B42318", background: "#FEF3F2", border: "1px solid #FECDCA", borderRadius: 8, padding: "8px 10px" }}>⚠️ {f.lastError}</div>}
                    {!f.analysis && !f.lastError && (!f.items || f.items.length === 0) && (
                      <div style={{ marginTop: 12, fontSize: 12.5, color: "#9ca3af" }}>
                        {refreshing === f.id ? "Analyse en cours…" : "Aucune analyse pour le moment. Cliquez sur « 🔄 Analyser » pour lancer la veille."}
                      </div>
                    )}
                    {f.analysis && (
                      <div style={{ marginTop: 12, background: "#F0F7FF", border: "1px solid #BFDBFE", borderRadius: 10, padding: "12px 14px" }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: "#1D4ED8", marginBottom: 6 }}>✦ Analyse d&apos;Auguste</div>
                        <div style={{ fontSize: 13, color: "#1E3A5F", lineHeight: 1.6 }}><Markdown text={f.analysis} /></div>
                      </div>
                    )}
                    {f.items && f.items.length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#6b7280", marginBottom: 5 }}>📰 Dernières publications</div>
                        <ul style={{ margin: 0, paddingLeft: 16, display: "flex", flexDirection: "column", gap: 3 }}>
                          {f.items.filter(itemHit).slice(0, ql ? 20 : 8).map((it, i) => (
                            <li key={i} style={{ fontSize: 12, lineHeight: 1.5 }}>
                              <a href={it.link || f.url} target="_blank" rel="noreferrer" style={{ color: "#374151", textDecoration: "none" }}>{it.title}</a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
              );
            })}
          </div>
          ));
        })()}
      </main>
    </div>
  );
}
