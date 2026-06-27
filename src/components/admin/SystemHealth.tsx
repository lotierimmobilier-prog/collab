"use client";
import { useState, useEffect, useCallback } from "react";

const GOLD = "#B8966A"; const DARK = "#1C1A17"; const BORDER = "#E6E1D9";
const GREEN = "#2F855A"; const AMBER = "#B45309"; const RED = "#DC2626";

interface Health {
  overall: "ok" | "warn" | "down";
  server: { ramTotal: number; ramUsed: number; ramPct: number; cpuCount: number; load1: number; cpuPct: number; appUptime: number; hostUptime: number; node: string };
  disk: { total: number; free: number; usedPct: number } | null;
  db: { ok: boolean; latencyMs: number; sizeBytes: number; tables: { name: string; bytes: number; rows: number }[] };
  storageBytes: number;
  checks: { name: string; status: "ok" | "warn" | "down"; detail: string }[];
  at: string;
}

function fmtBytes(b: number) {
  if (!b) return "0";
  const u = ["o", "Ko", "Mo", "Go", "To"]; let i = 0; let n = b;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}
function fmtUptime(s: number) {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d > 0 ? `${d} j ${h} h` : h > 0 ? `${h} h ${m} min` : `${m} min`;
}
const STATUS = { ok: { c: GREEN, l: "Opérationnel" }, warn: { c: AMBER, l: "À surveiller" }, down: { c: RED, l: "Problème" } };
function gaugeColor(pct: number) { return pct >= 90 ? RED : pct >= 80 ? AMBER : GREEN; }

export default function SystemHealth() {
  const [h, setH] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/health");
      if (r.ok) { setH(await r.json()); setErr(""); }
      else { const d = await r.json().catch(() => ({})); setErr(d.error || "Erreur"); }
    } catch { setErr("Serveur injoignable"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); const t = setInterval(load, 15_000); return () => clearInterval(t); }, [load]);

  if (loading) return <div style={{ padding: 40, color: "#9ca3af" }}>Mesure en cours…</div>;
  if (err || !h) return <div style={{ padding: 40, color: RED }}>{err || "Indisponible"}</div>;

  const ov = STATUS[h.overall];
  return (
    <div style={{ padding: 24, overflowY: "auto", height: "100%" }}>
      {/* Bandeau global */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#fff", border: `1px solid ${BORDER}`, borderLeft: `5px solid ${ov.c}`, borderRadius: 12, padding: "14px 18px", marginBottom: 18 }}>
        <div style={{ width: 12, height: 12, borderRadius: "50%", background: ov.c, boxShadow: `0 0 0 4px ${ov.c}22` }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: DARK }}>État général : {ov.l}</div>
          <div style={{ fontSize: 12, color: "#9ca3af" }}>Dernière mesure : {new Date(h.at).toLocaleTimeString("fr-FR")} · actualisation auto toutes les 15 s</div>
        </div>
        <button onClick={load} style={{ border: `1px solid ${BORDER}`, background: "#fff", borderRadius: 8, padding: "7px 12px", fontSize: 13, cursor: "pointer", color: GOLD }}>↻ Actualiser</button>
      </div>

      {/* Jauges capacité */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14, marginBottom: 18 }}>
        {h.disk && <Gauge title="Disque serveur" pct={h.disk.usedPct} sub={`${fmtBytes(h.disk.total - h.disk.free)} / ${fmtBytes(h.disk.total)} utilisés`} />}
        <Gauge title="Mémoire (RAM)" pct={h.server.ramPct} sub={`${fmtBytes(h.server.ramUsed)} / ${fmtBytes(h.server.ramTotal)}`} />
        <Gauge title="Processeur (CPU)" pct={h.server.cpuPct} sub={`Charge ${h.server.load1.toFixed(2)} sur ${h.server.cpuCount} cœur(s)`} />
      </div>

      {/* Cartes chiffres */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14, marginBottom: 18 }}>
        <Stat label="Base de données" value={fmtBytes(h.db.sizeBytes)} sub={h.db.ok ? `Latence ${h.db.latencyMs} ms` : "Injoignable"} color={h.db.ok ? GREEN : RED} />
        <Stat label="Stockage fichiers (drive + docs)" value={fmtBytes(h.storageBytes)} sub="inclus dans la base" />
        <Stat label="Disponibilité serveur" value={fmtUptime(h.server.hostUptime)} sub={`App : ${fmtUptime(h.server.appUptime)}`} />
        <Stat label="Node.js" value={h.server.node} sub={`${h.server.cpuCount} cœur(s)`} />
      </div>

      {/* Contrôles */}
      <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16, marginBottom: 18 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: DARK, marginBottom: 12 }}>Contrôles de bon fonctionnement</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {h.checks.map(c => {
            const s = STATUS[c.status];
            return (
              <div key={c.name} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: `1px solid #f3f4f6` }}>
                <div style={{ width: 9, height: 9, borderRadius: "50%", background: s.c, flexShrink: 0 }} />
                <div style={{ flex: 1, fontSize: 13, color: DARK }}>{c.name}</div>
                <div style={{ fontSize: 12, color: "#9ca3af" }}>{c.detail}</div>
                <span style={{ fontSize: 11, fontWeight: 600, color: s.c, width: 90, textAlign: "right" }}>{s.l}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Plus grosses tables */}
      <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: DARK, marginBottom: 12 }}>Occupation de la base par table</div>
        {h.db.tables.map(t => {
          const max = h.db.tables[0]?.bytes || 1;
          return (
            <div key={t.name} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: DARK, marginBottom: 3 }}>
                <span style={{ fontFamily: "ui-monospace, monospace" }}>{t.name}</span>
                <span style={{ color: "#6b7280" }}>{fmtBytes(t.bytes)} · {Math.round(t.rows).toLocaleString("fr-FR")} lignes</span>
              </div>
              <div style={{ height: 6, background: "#f3f4f6", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.max(2, (t.bytes / max) * 100)}%`, background: GOLD, borderRadius: 3 }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Gauge({ title, pct, sub }: { title: string; pct: number; sub: string }) {
  const c = gaugeColor(pct);
  return (
    <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: "#6b7280", marginBottom: 8 }}>{title}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: 26, fontWeight: 800, color: c }}>{pct}</span>
        <span style={{ fontSize: 14, color: c, fontWeight: 600 }}>%</span>
      </div>
      <div style={{ height: 8, background: "#f3f4f6", borderRadius: 4, overflow: "hidden", marginBottom: 8 }}>
        <div style={{ height: "100%", width: `${Math.min(100, pct)}%`, background: c, borderRadius: 4, transition: "width 0.4s" }} />
      </div>
      <div style={{ fontSize: 11.5, color: "#9ca3af" }}>{sub}</div>
    </div>
  );
}

function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: color || DARK, wordBreak: "break-word" }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: "#9ca3af", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}
