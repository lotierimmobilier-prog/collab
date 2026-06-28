import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getExtra } from "@/lib/user-extras";

const GOLD = "#B8966A", DARK = "#1C1A17";
const esc = (s: string) => (s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// GET /api/formation/attestation?filleulId=... — attestation de fin de formation.
// Accessible au filleul lui-même, à son parrain ou à un admin. Générée
// uniquement si toutes les compétences sont validées (parrain + filleul).
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const isAdmin = session.user.roleId === "admin";
  const filleulId = req.nextUrl.searchParams.get("filleulId") || session.user.id;

  // Contrôle d'accès.
  const isSelf = filleulId === session.user.id;
  const parrainId = (await getExtra(filleulId))?.parrainId ?? null;
  if (!isSelf && !isAdmin && parrainId !== session.user.id) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const filleul = await prisma.user.findUnique({ where: { id: filleulId }, select: { prenom: true, nom: true } }).catch(() => null);
  if (!filleul) return NextResponse.json({ error: "Filleul introuvable" }, { status: 404 });

  // Avancement : total des compétences actives vs validées des deux côtés.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const modules: any[] = await prisma.trainingModule.findMany({ where: { active: true }, select: { id: true, title: true, competences: { select: { id: true } } } }).catch(() => []);
  const allCompIds = modules.flatMap(m => m.competences.map((c: { id: string }) => c.id));
  const total = allCompIds.length;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const vals: any[] = await prisma.competenceValidation.findMany({ where: { filleulId }, select: { competenceId: true, parrainValidated: true, filleulValidated: true } }).catch(() => []);
  const doneSet = new Set(vals.filter(v => v.parrainValidated && v.filleulValidated).map(v => v.competenceId));
  const done = allCompIds.filter(id => doneSet.has(id)).length;

  if (!total || done < total) {
    return NextResponse.json({ error: "Formation non terminée", done, total }, { status: 409 });
  }

  const parrain = parrainId ? await prisma.user.findUnique({ where: { id: parrainId }, select: { prenom: true, nom: true } }).catch(() => null) : null;
  const fullName = `${filleul.prenom ?? ""} ${filleul.nom ?? ""}`.trim();
  const parrainName = parrain ? `${parrain.prenom ?? ""} ${parrain.nom ?? ""}`.trim() : "";
  const now = new Date().toLocaleDateString("fr-FR", { dateStyle: "long" });
  const moduleList = modules.map(m => `<li>${esc(m.title)}</li>`).join("");

  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Attestation de formation — ${esc(fullName)}</title>
<style>
body{font-family:Georgia,'Times New Roman',serif;color:${DARK};margin:0;background:#f4f1ec;padding:24px}
.sheet{max-width:780px;margin:0 auto;background:#fff;border:2px solid ${GOLD};border-radius:6px;padding:48px 56px;box-shadow:0 8px 30px rgba(0,0,0,0.10);position:relative}
.hd{text-align:center;border-bottom:1px solid #E6E1D9;padding-bottom:18px;margin-bottom:8px}
.hd .b{font-family:Arial,sans-serif;font-size:24px;letter-spacing:4px;font-weight:bold}.hd .b span{color:${GOLD}}
.hd .s{font-family:Arial,sans-serif;font-size:11px;color:${GOLD};letter-spacing:3px;text-transform:uppercase;margin-top:6px}
h1{text-align:center;font-size:26px;letter-spacing:1px;margin:30px 0 6px}
.sub{text-align:center;font-family:Arial,sans-serif;font-size:12px;text-transform:uppercase;letter-spacing:3px;color:#9b8e79;margin-bottom:26px}
.name{text-align:center;font-size:30px;color:${GOLD};margin:18px 0;font-weight:bold}
p{font-size:14.5px;line-height:1.8;text-align:center}
.mods{max-width:460px;margin:18px auto;font-size:13px;color:#3f3a33;text-align:left}
.foot{display:flex;justify-content:space-between;margin-top:46px;font-size:13px}
.print{position:fixed;top:14px;right:14px;background:${GOLD};color:#fff;border:none;border-radius:8px;padding:9px 15px;font-family:Arial,sans-serif;font-size:12.5px;cursor:pointer}@media print{.print{display:none}body{background:#fff;padding:0}.sheet{border:none;box-shadow:none}}
</style></head>
<body>
<button class="print" onclick="window.print()">Imprimer / Enregistrer en PDF</button>
<div class="sheet">
  <div class="hd"><div class="b">LOTIER<span> IMMOBILIER</span></div><div class="s">Votre agence de confiance</div></div>
  <h1>Attestation de formation</h1>
  <div class="sub">Formation par parrainage</div>
  <p>Nous attestons que</p>
  <div class="name">${esc(fullName)}</div>
  <p>a suivi avec succès et <strong>validé l'intégralité</strong> du parcours de formation par parrainage de Lotier Immobilier, soit <strong>${total}</strong> compétence${total > 1 ? "s" : ""} réparties sur les modules suivants :</p>
  <ul class="mods">${moduleList}</ul>
  <div class="foot">
    <div>Fait le ${now}${parrainName ? `<br/>Parrain : <strong>${esc(parrainName)}</strong>` : ""}</div>
    <div style="text-align:right">Pour Lotier Immobilier<br/><strong>La Direction</strong></div>
  </div>
</div>
</body></html>`;
  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
