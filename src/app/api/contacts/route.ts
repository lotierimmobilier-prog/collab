import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { seesAllContacts } from "@/lib/contactCategories";

/** GET /api/contacts?type=&q=  → liste de l'annuaire unifié.
 *  Cloisonnement : admin / gestionnaire / direction voient tout ;
 *  les autres ne voient que les contacts qu'ils ont créés. */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const type = (req.nextUrl.searchParams.get("type") || "").trim();
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  const seeAll = seesAllContacts(session.user.roleId);

  const contacts = await prisma.contact.findMany({
    where: {
      ...(seeAll ? {} : { createdById: session.user.id }),
      ...(type ? { type } : {}),
      ...(q ? { OR: [
        { nom:           { contains: q, mode: "insensitive" } },
        { prenom:        { contains: q, mode: "insensitive" } },
        { raisonSociale: { contains: q, mode: "insensitive" } },
        { email:         { contains: q, mode: "insensitive" } },
        { phone:         { contains: q, mode: "insensitive" } },
      ] } : {}),
    },
    orderBy: [{ type: "asc" }, { nom: "asc" }],
    take: 500,
  });

  return NextResponse.json({ contacts });
}

/** POST /api/contacts  → crée un contact dans l'annuaire. */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  // Le type peut être une catégorie par défaut ou personnalisée (admin) ;
  // on accepte tout identifiant non vide, sinon « autre ».
  const type = (body.type || "").trim() || "autre";
  const email = (body.email || "").toLowerCase().trim() || null;
  const prenom = (body.prenom || "").trim() || null;
  const nom = (body.nom || "").trim() || null;
  const raisonSociale = (body.raisonSociale || "").trim() || null;

  if (!email && !nom && !raisonSociale) {
    return NextResponse.json({ error: "Au moins un email, un nom ou une raison sociale est requis" }, { status: 400 });
  }

  // Évite les doublons sur l'email
  if (email) {
    const existing = await prisma.contact.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
    if (existing) return NextResponse.json({ contact: existing, alreadyExists: true });
  }

  const contact = await prisma.contact.create({
    data: {
      type, prenom, nom, raisonSociale, email,
      phone: (body.phone || "").trim() || null,
      note:  (body.note  || "").trim() || null,
      createdById: session.user.id,
    },
  });

  return NextResponse.json({ contact });
}
