import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getMailSettings, sendMail } from "@/lib/mailer";

// POST /api/admin/settings/test-mail — envoie un email de test.
//   body: { to?: string }  → destinataire au choix (par défaut : compte SMTP).
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.roleId !== "admin")
    return NextResponse.json({ error: "Réservé aux admins" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const cfg = await getMailSettings();
  const to = (typeof body?.to === "string" && body.to.trim()) ? body.to.trim() : cfg.user;
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return NextResponse.json({ ok: false, error: "Adresse email de destination invalide." }, { status: 400 });
  }

  // Objet/contenu personnalisés (test d'un mail type) ou message de test par défaut.
  const subject = (typeof body?.subject === "string" && body.subject.trim()) ? body.subject.trim() : "✅ Test email Collab";
  const html = (typeof body?.html === "string" && body.html.trim())
    ? body.html
    : `<div style="font-family:Arial,sans-serif;padding:24px;max-width:500px">
        <h2 style="color:#B8966A">Test de configuration réussi !</h2>
        <p>Votre serveur SMTP est correctement configuré pour <strong>Collab — Lotier Immobilier</strong>.</p>
        <p style="color:#6b7280;font-size:12px">Destinataire : ${to}<br/>Envoyé depuis : ${cfg.from}</p>
      </div>`;

  try {
    await sendMail({ to, subject, html });
    return NextResponse.json({ ok: true, to });
  } catch (err: unknown) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
}
