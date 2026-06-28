import { NextRequest, NextResponse } from "next/server";
import { resolveClientByEmail, createOtp, recentOtp } from "@/lib/client-auth";
import { sendMail } from "@/lib/mailer";
import { renderBrandedEmail } from "@/lib/email-template";

// POST /api/client/auth/request-code  body: { email }
// Envoie un code à usage unique au locataire si l'email correspond à un dossier.
// Réponse générique (pas d'énumération des emails).
export async function POST(req: NextRequest) {
  const { email } = await req.json().catch(() => ({}));
  const e = String(email ?? "").trim().toLowerCase();
  const generic = NextResponse.json({ ok: true, message: "Si un dossier correspond à cette adresse, un code vient d'être envoyé." });

  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) {
    return NextResponse.json({ ok: false, error: "Adresse email invalide." }, { status: 400 });
  }

  const client = await resolveClientByEmail(e);
  if (!client) return generic;                 // pas de dossier → réponse générique
  if (await recentOtp(e, 60)) return generic;  // déjà un code récent → on n'en renvoie pas

  const code = await createOtp(e);
  // Code de connexion : on l'envoie IMMÉDIATEMENT (synchrone) — le locataire
  // l'attend pour se connecter ; on ne diffère pas l'envoi.
  const content = `
    <h2 style="margin:0 0 12px;color:#1C1A17;font-size:18px;">Votre code de connexion</h2>
    <p style="margin:0 0 8px;color:#3f3a33;font-size:14px;line-height:1.6;">Bonjour ${client.prenom || ""},</p>
    <p style="margin:0 0 16px;color:#3f3a33;font-size:14px;line-height:1.6;">Voici votre code pour accéder à votre espace locataire :</p>
    <div style="font-size:30px;font-weight:bold;letter-spacing:8px;color:#B8966A;text-align:center;margin:18px 0;">${code}</div>
    <p style="margin:0;color:#9b8e79;font-size:12px;">Ce code est valable 10 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>`;
  try {
    const sent = await sendMail({ to: client.email, subject: "Votre code de connexion — Lotier Immobilier", html: renderBrandedEmail({ subject: "Votre code de connexion", contentHtml: content }) });
    if (!sent) return NextResponse.json({ ok: false, error: "L'envoi du code a échoué (configuration email). Contactez l'agence." }, { status: 502 });
  } catch {
    return NextResponse.json({ ok: false, error: "L'envoi du code a échoué. Réessayez dans un instant." }, { status: 502 });
  }

  return generic;
}
