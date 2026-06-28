import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { latestInsuranceWithTenant, setInsuranceReminderStage } from "@/lib/client-docs";
import { sendInsuranceReminder, STAGE } from "@/lib/insurance-reminders";

// POST — relance manuelle d'assurance pour un locataire (déclenchée par l'agence).
// Envoie un rappel adapté à l'échéance (ou une demande générique si aucune date).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;

  const row = (await latestInsuranceWithTenant()).find(r => r.tenantId === id);
  if (!row) return NextResponse.json({ error: "Aucune attestation d'assurance pour ce locataire." }, { status: 404 });
  if (!row.email) return NextResponse.json({ error: "Ce locataire n'a pas d'adresse email." }, { status: 400 });

  // Palier en fonction de l'échéance (par défaut J-30 si pas de date).
  let stage: number = STAGE.J30;
  let validUntil = new Date();
  if (row.validUntil) {
    validUntil = new Date(row.validUntil);
    const days = Math.ceil((validUntil.getTime() - Date.now()) / 86400000);
    stage = days < 0 ? STAGE.EXPIRED : days <= 7 ? STAGE.J7 : STAGE.J30;
  }

  const ok = await sendInsuranceReminder(row, stage, validUntil);
  if (!ok) return NextResponse.json({ error: "L'envoi de la relance a échoué." }, { status: 502 });
  // On mémorise le palier pour ne pas renvoyer automatiquement le même rappel.
  if (row.validUntil) await setInsuranceReminderStage(row.id, Math.max(stage, row.reminderStage));
  return NextResponse.json({ ok: true });
}
