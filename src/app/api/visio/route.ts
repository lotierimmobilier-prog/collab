import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { sendMail } from "@/lib/mailer";

const ALLOWED = ["admin", "dirigeant", "direction", "gestionnaire", "syndic", "agent", "commercial"];

// POST /api/visio — génère un lien de visio (salle vidéo) et l'envoie au besoin.
//   body: { contactName?, contactEmail?, sendEmail? }
// La salle est hébergée par Jitsi (meet.jit.si) : aucun compte requis, ouverture
// directe dans le navigateur du téléphone.
// TODO (bientôt) : visio intégrée à la marque Lotier, hébergée sur notre
// domaine (Jitsi self-hosted ou LiveKit). Il suffira de remplacer la base de
// l'URL ci-dessous par le serveur dédié (et d'embarquer la salle dans une page
// /visio/[room] interne) — le reste du flux (envoi du lien, email) ne change pas.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!ALLOWED.includes(session.user.roleId ?? "")) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const room = `Lotier-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
  const url = `https://meet.jit.si/${room}#config.prejoinPageEnabled=false`;
  const cleanUrl = `https://meet.jit.si/${room}`;

  let emailed = false;
  if (body?.sendEmail && body?.contactEmail) {
    try {
      await sendMail({
        to: String(body.contactEmail),
        subject: "Lotier Immobilier — Assistance vidéo en direct",
        html: `
<div style="font-family:Arial,sans-serif;max-width:540px;margin:0 auto;border:1px solid #E6E1D9;border-radius:12px;overflow:hidden">
  <div style="background:#B8966A;padding:18px 22px"><h1 style="color:#fff;margin:0;font-size:18px">Visio — Lotier Immobilier</h1></div>
  <div style="padding:22px;color:#1C1A17;font-size:14px;line-height:1.6">
    <p>Bonjour${body.contactName ? " " + body.contactName : ""},</p>
    <p>Pour vous aider en direct, rejoignez notre appel vidéo depuis votre téléphone en cliquant sur le bouton (autorisez la caméra et le micro) :</p>
    <p style="text-align:center;margin:24px 0">
      <a href="${cleanUrl}" style="background:#B8966A;color:#fff;text-decoration:none;padding:13px 24px;border-radius:8px;font-weight:700;display:inline-block">📹 Rejoindre la visio</a>
    </p>
    <p style="font-size:12px;color:#6b7280">Ou copiez ce lien : ${cleanUrl}</p>
  </div>
</div>`,
      });
      emailed = true;
    } catch { /* l'email peut échouer, le lien reste partageable */ }
  }

  return NextResponse.json({ ok: true, room, url, cleanUrl, emailed });
}
