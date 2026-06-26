import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mailer";
import { runMigrations } from "@/lib/run-migrations";

const ALLOWED = ["admin", "dirigeant", "direction", "gestionnaire", "syndic"];

function baseUrl(req: NextRequest): string {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "https";
  if (host) return `${proto}://${host}`;
  return process.env.NEXTAUTH_URL || "https://collab.lotier-immobilier.com";
}

function token() {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// GET /api/assistance — liste des demandes (agence).
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!ALLOWED.includes(session.user.roleId ?? "")) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  try {
    const requests = await prisma.assistanceRequest.findMany({ orderBy: [{ createdAt: "desc" }], take: 200 });
    return NextResponse.json({ requests });
  } catch {
    return NextResponse.json({ requests: [] });
  }
}

// POST /api/assistance — crée un lien d'assistance et l'envoie (option email).
//   body: { role?, contactName?, contactPhone?, contactEmail?, address?, sendEmail? }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (!ALLOWED.includes(session.user.roleId ?? "")) return NextResponse.json({ error: "Accès refusé" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const data = {
    token: token(),
    role: body?.role === "coproprietaire" ? "coproprietaire" : "locataire",
    contactName: body?.contactName?.trim() || null,
    contactPhone: body?.contactPhone?.trim() || null,
    contactEmail: body?.contactEmail?.trim() || null,
    address: body?.address?.trim() || null,
    status: "nouvelle",
    createdById: session.user.id,
  };

  let created;
  try {
    created = await prisma.assistanceRequest.create({ data });
  } catch (e) {
    if (/does not exist|assistance_requests/i.test(String(e))) {
      await runMigrations();
      created = await prisma.assistanceRequest.create({ data });
    } else {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  }

  const url = `${baseUrl(req)}/declaration/${created.token}`;

  let emailed = false;
  if (body?.sendEmail && data.contactEmail) {
    try {
      await sendMail({
        to: data.contactEmail,
        subject: "Lotier Immobilier — Déclarer votre problème (photos)",
        html: `
<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;border:1px solid #E6E1D9;border-radius:12px;overflow:hidden">
  <div style="background:#B8966A;padding:18px 22px"><h1 style="color:#fff;margin:0;font-size:18px">Assistance — Lotier Immobilier</h1></div>
  <div style="padding:22px;color:#1C1A17;font-size:14px;line-height:1.6">
    <p>Bonjour${data.contactName ? " " + data.contactName : ""},</p>
    <p>Pour traiter votre demande au plus vite, cliquez sur le lien ci-dessous depuis votre téléphone et :</p>
    <ul><li>décrivez le problème,</li><li>ajoutez des photos.</li></ul>
    <p style="text-align:center;margin:24px 0">
      <a href="${url}" style="background:#B8966A;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;display:inline-block">Déclarer mon problème</a>
    </p>
    <p style="font-size:12px;color:#6b7280">Ou copiez ce lien : ${url}</p>
  </div>
</div>`,
      });
      emailed = true;
    } catch { /* l'email peut échouer, le lien reste utilisable */ }
  }

  return NextResponse.json({ ok: true, id: created.id, token: created.token, url, emailed }, { status: 201 });
}
