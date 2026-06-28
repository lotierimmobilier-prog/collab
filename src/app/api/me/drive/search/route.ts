import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { roleCanSee } from "@/lib/drive-governance";

export const maxDuration = 30;
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface Node { id: string; parentId: string | null; kind: string; name: string; mime: string | null; size: number | null; visibility: string; templateKey: string | null; userId: string; updatedAt: Date }

// Construit le chemin « Dossier / Sous-dossier » d'un élément à partir de la
// carte des dossiers (limité au drive de l'utilisateur).
function pathOf(id: string | null, folders: Map<string, Node>): string {
  const parts: string[] = [];
  let cur = id; let guard = 0;
  while (cur && guard++ < 40) {
    const f = folders.get(cur);
    if (!f) break;
    parts.unshift(f.name);
    cur = f.parentId;
  }
  return parts.join(" / ");
}

// POST /api/me/drive/search — { q, ai? }
// Recherche dans le drive de l'utilisateur (ses fichiers/dossiers + les fichiers
// partagés des dossiers communs visibles selon son rôle). En mode "ai",
// Auguste interprète la demande en langage naturel et sélectionne les fichiers.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const uid = session.user.id;
  const role = (session.user as { roleId?: string }).roleId ?? null;

  const body = await req.json().catch(() => ({}));
  const q = String(body?.q ?? "").trim().slice(0, 200);
  const useAi = body?.ai === true;
  if (!q) return NextResponse.json({ results: [], answer: "" });

  const sel = { id: true, parentId: true, kind: true, name: true, mime: true, size: true, visibility: true, templateKey: true, userId: true, updatedAt: true } as const;

  // 1) Tous les éléments de l'utilisateur (sans binaire).
  const own = (await prisma.driveItem.findMany({ where: { userId: uid }, select: sel }).catch(() => [])) as Node[];

  // 2) Fichiers partagés : dossiers communs (templateKey) visibles selon le rôle,
  //    fichiers déposés par les autres agents.
  const myFolders = own.filter(n => n.kind === "folder");
  const visibleTpl = new Set(myFolders.filter(f => f.templateKey && roleCanSee(f.visibility, role)).map(f => f.templateKey as string));
  let shared: Node[] = [];
  const sharedFromBy = new Map<string, string>();
  if (visibleTpl.size) {
    const peerFolders = (await prisma.driveItem.findMany({ where: { templateKey: { in: [...visibleTpl] }, userId: { not: uid }, kind: "folder" }, select: { id: true, userId: true } }).catch(() => [])) as { id: string; userId: string }[];
    if (peerFolders.length) {
      const owners = new Map(peerFolders.map(p => [p.id, p.userId]));
      const files = (await prisma.driveItem.findMany({ where: { parentId: { in: peerFolders.map(p => p.id) }, kind: "file" }, select: sel }).catch(() => [])) as Node[];
      const users = (await prisma.user.findMany({ where: { id: { in: [...new Set(peerFolders.map(p => p.userId))] } }, select: { id: true, prenom: true, nom: true } }).catch(() => [])) as { id: string; prenom: string; nom: string }[];
      const nameById = new Map(users.map(u => [u.id, `${u.prenom} ${u.nom}`.trim()]));
      shared = files;
      for (const f of files) sharedFromBy.set(f.id, nameById.get(owners.get(f.parentId ?? "") ?? "") ?? "Agence");
    }
  }

  const folderMap = new Map(myFolders.map(f => [f.id, f]));
  // Catalogue interrogeable = fichiers de l'utilisateur + fichiers partagés.
  // (On cherche surtout des fichiers ; on inclut aussi les dossiers de l'agent.)
  const catalog = [...own.filter(n => n.kind === "file" || n.kind === "folder"), ...shared];

  const fmt = (n: Node) => ({
    id: n.id,
    kind: n.kind,
    name: n.name,
    mime: n.mime,
    size: n.size,
    folder: pathOf(n.parentId, folderMap) || (sharedFromBy.has(n.id) ? "Partagé" : "Racine"),
    sharedFrom: sharedFromBy.get(n.id) ?? null,
    updatedAt: n.updatedAt.toISOString(),
  });

  // Recherche texte : tous les mots de la requête doivent apparaître (accents ignorés).
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  function textSearch(query: string) {
    const tokens = norm(query).split(/\s+/).filter(t => t.length >= 2);
    if (!tokens.length) return [] as Node[];
    return catalog.filter(n => { const hay = norm(n.name); return tokens.every(t => hay.includes(t)); });
  }

  // Mode simple (ou repli) : recherche texte directe.
  if (!useAi || !process.env.ANTHROPIC_API_KEY) {
    const hits = textSearch(q).slice(0, 60).map(fmt);
    return NextResponse.json({ results: hits, answer: "" });
  }

  // Mode Auguste : il choisit les fichiers pertinents à partir du catalogue.
  // On limite le catalogue envoyé pour rester économe.
  const lite = catalog.slice(0, 500).map(n => `${n.id}\t${n.kind === "folder" ? "[dossier] " : ""}${n.name}\t(${pathOf(n.parentId, folderMap) || "Racine"})`).join("\n");
  const SYSTEM = `Tu es Auguste, l'assistant de l'agence Lotier Immobilier. On te donne le CATALOGUE des fichiers du drive d'un agent (une ligne = "id<TAB>nom<TAB>(dossier)") et une demande en langage naturel.
Sélectionne les fichiers/dossiers les plus pertinents pour la demande (synonymes, type de document, sujet). Classe-les du plus pertinent au moins pertinent.
Réponds STRICTEMENT en JSON : {"ids":["id1","id2",...],"answer":"courte phrase expliquant ce que tu as trouvé"}. Mets au plus 20 ids. Si rien ne correspond, renvoie {"ids":[],"answer":"..."}. N'invente aucun id absent du catalogue.`;
  try {
    const resp = await anthropic.messages.create({
      model: "claude-sonnet-4-6", max_tokens: 700, system: SYSTEM,
      messages: [{ role: "user", content: `CATALOGUE :\n${lite}\n\nDEMANDE : ${q}` }],
    });
    const raw = resp.content.filter(x => x.type === "text").map(x => (x as Anthropic.TextBlock).text).join("").trim();
    const m = raw.match(/\{[\s\S]*\}/);
    const parsed = m ? JSON.parse(m[0]) : { ids: [], answer: "" };
    const byId = new Map(catalog.map(n => [n.id, n]));
    const ids: string[] = Array.isArray(parsed.ids) ? parsed.ids : [];
    let results = ids.map(id => byId.get(id)).filter(Boolean).slice(0, 20).map(n => fmt(n as Node));
    // Repli : si Auguste ne renvoie rien d'exploitable, on retombe sur la recherche texte.
    if (!results.length) results = textSearch(q).slice(0, 60).map(fmt);
    return NextResponse.json({ results, answer: String(parsed.answer ?? "").slice(0, 400) });
  } catch {
    const hits = textSearch(q).slice(0, 60).map(fmt);
    return NextResponse.json({ results: hits, answer: "" });
  }
}
