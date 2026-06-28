import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { GESTION_ROLES } from "@/lib/admin";
import { PORTALS } from "@/lib/portalLeads";

// La gestion du registre (création / édition) est réservée à la direction,
// l'administration et les gestionnaires ; la lecture est ouverte aux agents
// connectés (le moteur de réponse en a besoin).
function canManage(session: { user?: { roleId?: string; superAdmin?: boolean } } | null): boolean {
  return !!session?.user && (session.user.superAdmin === true || GESTION_ROLES.includes(session.user.roleId ?? ""));
}

const PLATFORM_IDS = new Set(PORTALS.map(p => p.id));

// GET — liste des annonces du registre
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const listings = await prisma.portalListing.findMany({ orderBy: [{ platform: "asc" }, { reference: "asc" }] }).catch(() => []);
  return NextResponse.json({ listings, canManage: canManage(session) });
}

// POST — créer une annonce
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!canManage(session)) return NextResponse.json({ error: "Réservé à la direction / gestion." }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const platform = String(b?.platform ?? "");
  const reference = String(b?.reference ?? "").trim();
  if (!PLATFORM_IDS.has(platform)) return NextResponse.json({ error: "Plateforme inconnue." }, { status: 400 });
  if (!reference) return NextResponse.json({ error: "Référence requise." }, { status: 400 });

  try {
    const listing = await prisma.portalListing.create({
      data: {
        platform, reference,
        title:            b?.title ? String(b.title).slice(0, 200) : null,
        price:            b?.price ? String(b.price).slice(0, 40) : null,
        type:             b?.type === "gestion" ? "gestion" : "vente",
        agentName:        b?.agentName ? String(b.agentName).slice(0, 120) : null,
        agentPhone:       b?.agentPhone ? String(b.agentPhone).slice(0, 40) : null,
        ficheDriveItemId: b?.ficheDriveItemId ? String(b.ficheDriveItemId) : null,
        zelokLink:        b?.zelokLink ? String(b.zelokLink).slice(0, 500) : null,
        active:           b?.active !== false,
        createdBy:        session.user.id,
      },
    });
    return NextResponse.json({ ok: true, listing }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error && e.message.includes("Unique") ? "Cette référence existe déjà pour ce portail." : "Création impossible.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

// PATCH — modifier une annonce
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!canManage(session)) return NextResponse.json({ error: "Réservé à la direction / gestion." }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const id = String(b?.id ?? "");
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (b.title !== undefined)            data.title = b.title ? String(b.title).slice(0, 200) : null;
  if (b.price !== undefined)            data.price = b.price ? String(b.price).slice(0, 40) : null;
  if (b.type !== undefined)             data.type = b.type === "gestion" ? "gestion" : "vente";
  if (b.reference !== undefined)        data.reference = String(b.reference).trim();
  if (b.agentName !== undefined)        data.agentName = b.agentName ? String(b.agentName).slice(0, 120) : null;
  if (b.agentPhone !== undefined)       data.agentPhone = b.agentPhone ? String(b.agentPhone).slice(0, 40) : null;
  if (b.ficheDriveItemId !== undefined) data.ficheDriveItemId = b.ficheDriveItemId ? String(b.ficheDriveItemId) : null;
  if (b.zelokLink !== undefined)        data.zelokLink = b.zelokLink ? String(b.zelokLink).slice(0, 500) : null;
  if (b.active !== undefined)           data.active = b.active !== false;

  try {
    const listing = await prisma.portalListing.update({ where: { id }, data });
    return NextResponse.json({ ok: true, listing });
  } catch {
    return NextResponse.json({ error: "Modification impossible." }, { status: 400 });
  }
}

// DELETE — supprimer une annonce (?id=...)
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!canManage(session)) return NextResponse.json({ error: "Réservé à la direction / gestion." }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  await prisma.portalListing.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
