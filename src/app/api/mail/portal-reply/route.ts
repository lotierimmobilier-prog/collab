import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { detectPortal, findMatchingReference, buildReply, portalLabel } from "@/lib/portalLeads";

// POST /api/mail/portal-reply — détecte si un mail provient d'un portail
// (Leboncoin / Bien'ici / Le Figaro), retrouve l'annonce dans le registre et
// prépare un BROUILLON de réponse (vente : fiche jointe ; gestion : lien ZELOK).
// Ne PARTICIPE PAS à l'envoi : l'agent valide et envoie lui-même.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const fromEmail = String(b?.from ?? "");
  const subject = String(b?.subject ?? "");
  const body = String(b?.body ?? "");

  const portal = detectPortal(fromEmail);
  if (!portal) return NextResponse.json({ matched: false });

  const listings = await prisma.portalListing.findMany({ where: { platform: portal.id, active: true } }).catch(() => []);
  if (!listings.length) return NextResponse.json({ matched: false, portal: portal.id, portalLabel: portal.label, reason: "no-listings" });

  const ref = findMatchingReference(`${subject}\n${body}`, listings.map(l => l.reference));
  const listing = ref ? listings.find(l => l.reference === ref) : null;
  if (!listing) return NextResponse.json({ matched: false, portal: portal.id, portalLabel: portal.label, reason: "no-reference" });

  const replyText = buildReply({
    type: listing.type, reference: listing.reference, price: listing.price,
    agentName: listing.agentName, agentPhone: listing.agentPhone, zelokLink: listing.zelokLink,
  });

  // Pièce jointe « vente » : la fiche PDF du drive, si renseignée. On renvoie
  // directement son contenu (base64) pour que l'agent l'envoie en pièce jointe.
  let attachment: { id: string; name: string; mime: string | null; size: number; content: string } | null = null;
  if (listing.type === "vente" && listing.ficheDriveItemId) {
    const file = await prisma.driveItem.findUnique({
      where: { id: listing.ficheDriveItemId },
      select: { id: true, name: true, mime: true, kind: true, size: true, data: true },
    }).catch(() => null);
    if (file && file.kind === "file" && file.data) {
      attachment = { id: file.id, name: file.name, mime: file.mime, size: file.size ?? 0, content: file.data };
    }
  }

  return NextResponse.json({
    matched: true,
    portal: portal.id,
    portalLabel: portalLabel(portal.id),
    type: listing.type,
    reference: listing.reference,
    title: listing.title,
    subject: `Re: ${subject || "Votre demande"}`,
    replyText,
    attachment,                                  // fiche à joindre (vente)
    zelokLink: listing.type === "gestion" ? listing.zelokLink : null,
    missing: {
      fiche: listing.type === "vente" && !attachment,
      zelok: listing.type === "gestion" && !listing.zelokLink,
    },
  });
}
