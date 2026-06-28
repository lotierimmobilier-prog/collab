import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { uploadsCountByTenant, latestInsuranceByTenant, insuranceStatus } from "@/lib/client-docs";

// GET — liste des locataires pour l'espace agence (statut portail + justificatifs reçus).
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tenants: any[] = await prisma.tenant.findMany({
    select: { id: true, prenom: true, nom: true, email: true },
    orderBy: [{ nom: "asc" }, { prenom: "asc" }],
  });
  const counts = await uploadsCountByTenant();
  const insurance = await latestInsuranceByTenant();

  return NextResponse.json({
    clients: tenants.map(t => {
      const ins = insurance.get(t.id);
      return {
        id: t.id, prenom: t.prenom, nom: t.nom, email: t.email,
        hasPortal: !!t.email,                 // peut se connecter
        uploads: counts.get(t.id) ?? 0,       // justificatifs déposés
        insurance: insuranceStatus(ins?.validUntil ?? null), // statut assurance
      };
    }),
  });
}
