import { NextResponse } from "next/server";
import os from "node:os";
import { statfs } from "node:fs/promises";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/admin/health — tableau de bord santé/performances (ADMIN).
// Serveur (CPU/RAM/disque), base de données, stockage des fichiers, et
// contrôles « tout fonctionne ».
export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.roleId !== "admin")
    return NextResponse.json({ error: "Réservé aux administrateurs" }, { status: 403 });

  // ── Serveur : RAM / CPU / uptime ──
  const totalMem = os.totalmem(), freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  const cpus = os.cpus()?.length || 1;
  const load1 = os.loadavg()[0] || 0;
  const server = {
    ramTotal: totalMem, ramUsed: usedMem, ramPct: Math.round((usedMem / totalMem) * 100),
    cpuCount: cpus, load1, cpuPct: Math.min(100, Math.round((load1 / cpus) * 100)),
    appUptime: Math.round(process.uptime()),
    hostUptime: Math.round(os.uptime()),
    node: process.version,
  };

  // ── Disque ──
  let disk: { total: number; free: number; usedPct: number } | null = null;
  try {
    const s = await statfs("/");
    const total = Number(s.blocks) * Number(s.bsize);
    const free = Number(s.bavail) * Number(s.bsize);
    disk = { total, free, usedPct: total ? Math.round(((total - free) / total) * 100) : 0 };
  } catch { disk = null; }

  // ── Base de données : latence, taille, plus grosses tables ──
  let db: { ok: boolean; latencyMs: number; sizeBytes: number; tables: { name: string; bytes: number; rows: number }[] } = { ok: false, latencyMs: 0, sizeBytes: 0, tables: [] };
  try {
    const t0 = Date.now();
    await prisma.$queryRawUnsafe("SELECT 1");
    const latencyMs = Date.now() - t0;
    const sizeRows = await prisma.$queryRawUnsafe("SELECT pg_database_size(current_database())::float8 AS size") as { size: number }[];
    const tables = await prisma.$queryRawUnsafe(
      `SELECT relname AS name, pg_total_relation_size(relid)::float8 AS bytes, n_live_tup::float8 AS rows
       FROM pg_stat_user_tables ORDER BY bytes DESC LIMIT 10`,
    ) as { name: string; bytes: number; rows: number }[];
    db = { ok: true, latencyMs, sizeBytes: Number(sizeRows?.[0]?.size ?? 0), tables: tables.map(t => ({ name: t.name, bytes: Number(t.bytes), rows: Number(t.rows) })) };
  } catch {
    db = { ok: false, latencyMs: 0, sizeBytes: 0, tables: [] };
  }

  // ── Stockage « fichiers » (drive + documents, stockés en base) ──
  const fileTables = ["drive_items", "personal_documents", "service_orders", "email_messages", "internal_messages", "suppliers", "direction_meetings"];
  const storageBytes = db.tables.filter(t => fileTables.includes(t.name)).reduce((a, t) => a + t.bytes, 0);

  // ── Contrôles « tout fonctionne » ──
  const checks: { name: string; status: "ok" | "warn" | "down"; detail: string }[] = [];
  checks.push({ name: "Base de données", status: db.ok ? (db.latencyMs > 500 ? "warn" : "ok") : "down", detail: db.ok ? `Réponse en ${db.latencyMs} ms` : "Injoignable" });
  checks.push({ name: "Assistant Auguste (IA)", status: process.env.ANTHROPIC_API_KEY ? "ok" : "warn", detail: process.env.ANTHROPIC_API_KEY ? "Clé API configurée" : "Clé API absente" });
  if (disk) checks.push({ name: "Espace disque", status: disk.usedPct >= 90 ? "down" : disk.usedPct >= 80 ? "warn" : "ok", detail: `${disk.usedPct}% utilisé` });
  checks.push({ name: "Mémoire (RAM)", status: server.ramPct >= 92 ? "down" : server.ramPct >= 85 ? "warn" : "ok", detail: `${server.ramPct}% utilisée` });
  try {
    const cfg = await prisma.mailAccountConfig.count({ where: { smtpHost: { not: null } } }).catch(() => 0);
    const sysSmtp = await prisma.setting.findUnique({ where: { key: "smtp_pass" } }).catch(() => null);
    const mailOk = cfg > 0 || !!sysSmtp?.value;
    checks.push({ name: "Envoi d'emails (SMTP)", status: mailOk ? "ok" : "warn", detail: mailOk ? "Configuré" : "Non configuré" });
  } catch { /* ignore */ }
  // Migrations : présence des tables récentes.
  try {
    const recent = ["personal_documents", "drive_items", "suppliers"];
    const present = db.tables.map(t => t.name);
    const missing = recent.filter(r => !present.includes(r));
    // n_live_tup peut être 0 → la table existe sans être dans pg_stat ; on vérifie via information_schema.
    const rows = await prisma.$queryRawUnsafe(
      `SELECT count(*)::int AS n FROM information_schema.tables WHERE table_name = ANY($1)`, recent,
    ) as { n: number }[];
    const cnt = Number(rows?.[0]?.n ?? 0);
    checks.push({ name: "Migrations base", status: cnt >= recent.length ? "ok" : "warn", detail: cnt >= recent.length ? "À jour" : `${recent.length - cnt} table(s) manquante(s) (${missing.join(", ")})` });
  } catch { /* ignore */ }

  const overall = checks.some(c => c.status === "down") ? "down" : checks.some(c => c.status === "warn") ? "warn" : "ok";

  return NextResponse.json({ overall, server, disk, db, storageBytes, checks, at: new Date().toISOString() });
}
