"use client";
import { useState, useEffect, useCallback } from "react";
import Sidebar from "@/components/Sidebar";

const GOLD = "#B8966A"; const DARK = "#1C1A17"; const BORDER = "#E6E1D9"; const BLUE = "#2563EB";

interface Item { title: string; link: string; date: string; summary: string }
interface Feed { id: string; title: string; items: Item[] | null }
interface Row extends Item { feedTitle: string; ts: number }

export default function ActualitePage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const d = await fetch("/api/veille").then(r => r.json());
      const feeds: Feed[] = (d.feeds ?? []).map((f: Feed) => ({ ...f, items: typeof f.items === "string" ? JSON.parse(f.items as unknown as string) : f.items }));
      const all: Row[] = [];
      for (const f of feeds) for (const it of (f.items ?? [])) {
        const ts = Date.parse(it.date || "") || 0;
        all.push({ ...it, feedTitle: f.title, ts });
      }
      all.sort((a, b) => b.ts - a.ts);
      setRows(all);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#FAF8F5" }}>
      <Sidebar active="actualite" />
      <main style={{ flex: 1, padding: "28px 32px", maxWidth: 860, margin: "0 auto", width: "100%" }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: DARK, margin: 0 }}>📰 Actualité</h1>
        <p style={{ color: "#6b7280", fontSize: 13, marginTop: 4, marginBottom: 18 }}>
          Le fil des dernières publications de tous vos flux de veille, du plus récent au plus ancien. Gérez les flux dans <a href="/veille-juridique" style={{ color: GOLD, textDecoration: "none", fontWeight: 600 }}>Veille</a>.
        </p>

        {loading ? (
          <p style={{ color: "#9ca3af", fontSize: 13 }}>Chargement…</p>
        ) : rows.length === 0 ? (
          <p style={{ color: "#9ca3af", fontSize: 13 }}>Aucune actualité pour le moment. Ajoutez des flux dans <a href="/veille-juridique" style={{ color: GOLD }}>Veille</a>.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {rows.slice(0, 100).map((r, i) => (
              <a key={i} href={r.link || "#"} target="_blank" rel="noreferrer"
                style={{ display: "block", background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: "12px 14px", textDecoration: "none", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline", marginBottom: 3 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: GOLD }}>{r.feedTitle}</span>
                  {r.ts > 0 && <span style={{ fontSize: 11, color: "#9ca3af", flexShrink: 0 }}>{new Date(r.ts).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" })}</span>}
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, color: DARK, marginBottom: 3 }}>{r.title}</div>
                {r.summary && <div style={{ fontSize: 12.5, color: "#6b7280", lineHeight: 1.5 }}>{r.summary.slice(0, 240)}{r.summary.length > 240 ? "…" : ""}</div>}
                {r.link && <div style={{ fontSize: 11, color: BLUE, marginTop: 4 }}>Lire l&apos;article →</div>}
              </a>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
