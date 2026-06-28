import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { computeOverview, type OvFilleul } from "@/lib/formation-overview";

const GOLD = "#B8966A", DARK = "#1C1A17";
const esc = (s: string) => (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const pct = (n: number) => `${Math.round(n * 100)}%`;
const STATUS: Record<string, { label: string; color: string }> = {
  termine: { label: "Terminé", color: "#059669" },
  en_cours: { label: "En cours", color: "#2563eb" },
  en_retard: { label: "En retard", color: "#dc2626" },
  jamais: { label: "Jamais commencé", color: "#9ca3af" },
};

function bar(p: number): string {
  return `<div style="background:#eee;border-radius:6px;height:9px;width:90px;overflow:hidden;display:inline-block;vertical-align:middle"><div style="background:${GOLD};height:9px;width:${Math.round(p * 100)}%"></div></div>`;
}

function rowHtml(f: OvFilleul): string {
  const st = STATUS[f.status];
  const q = f.quiz.rate === null ? "—" : pct(f.quiz.rate);
  const la = f.lastActivity ? new Date(f.lastActivity).toLocaleDateString("fr-FR") : "—";
  return `<tr>
    <td>${esc(f.prenom)} ${esc(f.nom)}</td>
    <td>${f.parrain ? esc(f.parrain.prenom) + " " + esc(f.parrain.nom) : "<i style='color:#9ca3af'>—</i>"}</td>
    <td>${bar(f.progress)} ${pct(f.progress)} <span style="color:#9ca3af">(${f.done}/${f.total})</span></td>
    <td>${q}</td>
    <td>${la}</td>
    <td><span style="color:${st.color};font-weight:bold">${st.label}</span></td>
  </tr>`;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const isAdmin = session.user.roleId === "admin";
  const ov = await computeOverview(session.user.id, isAdmin);
  const filleulId = req.nextUrl.searchParams.get("filleulId");

  const now = new Date().toLocaleDateString("fr-FR", { dateStyle: "long" });
  const head = `<div style="text-align:center;border-bottom:2px solid ${GOLD};padding-bottom:14px;margin-bottom:20px">
    <div style="font-family:Arial,sans-serif;font-size:22px;letter-spacing:4px;font-weight:bold">LOTIER<span style="color:${GOLD}"> IMMOBILIER</span></div>
    <div style="font-family:Arial,sans-serif;font-size:11px;color:${GOLD};letter-spacing:2px;text-transform:uppercase;margin-top:5px">Bilan de formation par parrainage</div></div>`;

  let body: string;
  if (filleulId) {
    const f = ov.filleuls.find(x => x.id === filleulId);
    if (!f) return NextResponse.json({ error: "Filleul introuvable dans votre périmètre" }, { status: 404 });
    const st = STATUS[f.status];
    const modRows = ov.modules.map(m => {
      const pm = f.perModule.find(x => x.moduleId === m.id);
      const d = pm?.done ?? 0, t = pm?.total ?? m.competences.length;
      return `<tr><td>${esc(m.title)}</td><td>${bar(t ? d / t : 0)} ${d}/${t}</td></tr>`;
    }).join("");
    body = `<h1 style="font-size:18px;text-align:center;margin:0 0 6px">${esc(f.prenom)} ${esc(f.nom)}</h1>
      <p style="text-align:center;color:#6b6357;margin:0 0 20px">Parrain : ${f.parrain ? esc(f.parrain.prenom) + " " + esc(f.parrain.nom) : "non attribué"} · Statut : <strong style="color:${st.color}">${st.label}</strong></p>
      <table><thead><tr><th>Indicateur</th><th>Valeur</th></tr></thead><tbody>
        <tr><td>Avancement global</td><td>${bar(f.progress)} ${pct(f.progress)} (${f.done}/${f.total} compétences)</td></tr>
        <tr><td>QCM</td><td>${f.quiz.rate === null ? "Aucune réponse" : `${pct(f.quiz.rate)} (${f.quiz.correct}/${f.quiz.answered})`}</td></tr>
        <tr><td>Dernière activité</td><td>${f.lastActivity ? new Date(f.lastActivity).toLocaleDateString("fr-FR") : "—"}</td></tr>
      </tbody></table>
      <h2 style="font-size:14px;margin:24px 0 8px;color:${DARK}">Détail par module</h2>
      <table><thead><tr><th>Module</th><th>Compétences validées</th></tr></thead><tbody>${modRows}</tbody></table>`;
  } else {
    const k = ov.kpi;
    const kpiCard = (label: string, val: string, color = DARK) => `<div style="border:1px solid #E6E1D9;border-radius:10px;padding:10px 14px;min-width:120px"><div style="font-size:20px;font-weight:bold;color:${color}">${val}</div><div style="font-size:11px;color:#9ca3af">${esc(label)}</div></div>`;
    const parrainRows = ov.parrains.map(p => `<tr><td>${esc(p.prenom)} ${esc(p.nom)}</td><td>${p.filleulsCount}</td><td>${bar(p.avgProgress)} ${pct(p.avgProgress)}</td><td>${p.enRetard ? `<span style="color:#dc2626;font-weight:bold">${p.enRetard}</span>` : "0"}</td></tr>`).join("");
    body = `<h1 style="font-size:18px;text-align:center;margin:0 0 18px">Bilan global de la formation</h1>
      <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-bottom:24px">
        ${kpiCard("Filleuls suivis", String(k.filleuls))}
        ${kpiCard("Avancement moyen", pct(k.avgProgress), GOLD)}
        ${kpiCard("Terminés", String(k.termine), "#059669")}
        ${kpiCard("En retard", String(k.enRetard), k.enRetard ? "#dc2626" : DARK)}
        ${kpiCard("Réussite QCM", k.avgQuiz === null ? "—" : pct(k.avgQuiz))}
      </div>
      <h2 style="font-size:14px;margin:0 0 8px;color:${DARK}">Avancement par filleul</h2>
      <table><thead><tr><th>Filleul</th><th>Parrain</th><th>Avancement</th><th>QCM</th><th>Dernière activité</th><th>Statut</th></tr></thead><tbody>${ov.filleuls.map(rowHtml).join("")}</tbody></table>
      ${ov.parrains.length ? `<h2 style="font-size:14px;margin:24px 0 8px;color:${DARK}">Charge des parrains</h2>
      <table><thead><tr><th>Parrain</th><th>Filleuls</th><th>Avancement moyen</th><th>À relancer</th></tr></thead><tbody>${parrainRows}</tbody></table>` : ""}`;
  }

  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Bilan de formation — Lotier Immobilier</title>
<style>body{font-family:Arial,Helvetica,sans-serif;color:${DARK};max-width:900px;margin:0 auto;padding:32px 28px;font-size:13px}
table{width:100%;border-collapse:collapse;margin:0 0 10px}th{background:#F7F0E6;color:${DARK};text-align:left;font-size:11.5px;padding:7px 9px;border-bottom:2px solid ${GOLD}}
td{padding:7px 9px;border-bottom:1px solid #eee;vertical-align:middle}
.print{position:fixed;top:14px;right:14px;background:${GOLD};color:#fff;border:none;border-radius:8px;padding:9px 15px;font-size:12.5px;cursor:pointer}@media print{.print{display:none}}
.foot{margin-top:26px;text-align:center;color:#9ca3af;font-size:11px}</style></head>
<body><button class="print" onclick="window.print()">Imprimer / Enregistrer en PDF</button>
${head}${body}
<div class="foot">Édité le ${now} · Lotier Immobilier — document interne</div></body></html>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
