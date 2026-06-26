import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// Récupère le lien de parrainage entre le filleul et l'utilisateur courant.
async function relationFor(currentUserId: string, isAdmin: boolean, filleulId: string) {
  const filleul = await prisma.user.findUnique({
    where: { id: filleulId },
    select: { id: true, prenom: true, nom: true, parrainId: true },
  });
  if (!filleul) return { filleul: null, isSelf: false, isParrain: false };
  return {
    filleul,
    isSelf: filleul.id === currentUserId,
    isParrain: filleul.parrainId === currentUserId || isAdmin,
  };
}

// GET /api/formation/validations?filleulId=... — validations d'un filleul.
//   Accessible : le filleul lui-même, son parrain, ou un admin.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const isAdmin = session.user.roleId === "admin";

  const filleulId = req.nextUrl.searchParams.get("filleulId") || session.user.id;
  const rel = await relationFor(session.user.id, isAdmin, filleulId);
  if (!rel.filleul) return NextResponse.json({ error: "Filleul introuvable" }, { status: 404 });
  if (!rel.isSelf && !rel.isParrain) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const validations = await prisma.competenceValidation.findMany({
    where: { filleulId },
  });
  return NextResponse.json({ filleul: rel.filleul, validations });
}

// POST /api/formation/validations — actions sur une validation.
//   body: { competenceId, filleulId, action, ... }
//   action "setDates"        : { dates: string[] }  (côté filleul ou parrain)
//   action "validateFilleul" : { value:boolean, comment? }  (filleul ou admin)
//   action "validateParrain" : { value:boolean, comment? }  (parrain ou admin)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const isAdmin = session.user.roleId === "admin";

  const body = await req.json();
  const competenceId = body?.competenceId;
  const filleulId = body?.filleulId;
  const action = body?.action;
  if (!competenceId || !filleulId || !action) {
    return NextResponse.json({ error: "competenceId, filleulId et action obligatoires" }, { status: 400 });
  }

  const rel = await relationFor(session.user.id, isAdmin, filleulId);
  if (!rel.filleul) return NextResponse.json({ error: "Filleul introuvable" }, { status: 404 });

  // Vérification des droits selon l'action.
  if (action === "validateParrain") {
    if (!rel.isParrain) return NextResponse.json({ error: "Réservé au parrain" }, { status: 403 });
  } else if (action === "validateFilleul") {
    if (!rel.isSelf && !isAdmin) return NextResponse.json({ error: "Réservé au filleul" }, { status: 403 });
  } else if (action === "setDates") {
    if (!rel.isSelf && !rel.isParrain) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  } else if (action === "setQuiz") {
    if (!rel.isSelf && !isAdmin) return NextResponse.json({ error: "Réservé au filleul" }, { status: 403 });
  } else {
    return NextResponse.json({ error: "action inconnue" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const update: any = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const create: any = { competenceId, filleulId };

  if (action === "setDates") {
    const dates = Array.isArray(body?.dates)
      ? body.dates.map((d: unknown) => String(d)).filter(Boolean)
      : [];
    update.dates = dates;
    create.dates = dates;
  } else if (action === "setQuiz") {
    // { quiz: { "<questionId>": <indexChoisi> } }
    const quiz = body?.quiz && typeof body.quiz === "object" ? body.quiz : {};
    update.quiz = quiz;
    create.quiz = quiz;
  } else if (action === "validateParrain") {
    const value = !!body?.value;
    update.parrainValidated = value;
    update.parrainValidatedAt = value ? new Date() : null;
    if (body?.comment !== undefined) update.parrainComment = body.comment?.trim() || null;
    create.parrainValidated = value;
    create.parrainValidatedAt = value ? new Date() : null;
    create.parrainComment = body?.comment?.trim() || null;
  } else if (action === "validateFilleul") {
    const value = !!body?.value;
    update.filleulValidated = value;
    update.filleulValidatedAt = value ? new Date() : null;
    if (body?.comment !== undefined) update.filleulComment = body.comment?.trim() || null;
    create.filleulValidated = value;
    create.filleulValidatedAt = value ? new Date() : null;
    create.filleulComment = body?.comment?.trim() || null;
  }

  try {
    const v = await prisma.competenceValidation.upsert({
      where: { competenceId_filleulId: { competenceId, filleulId } },
      update,
      create,
    });
    return NextResponse.json(v);
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
