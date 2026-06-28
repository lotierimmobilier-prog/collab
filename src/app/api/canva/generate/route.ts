import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { generateVisual } from "@/lib/canva";

// POST /api/canva/generate — { templateId, fields: { name: text } }
// Remplit le modèle avec les valeurs texte fournies puis renvoie l'URL du
// visuel exporté (JPG).
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const b = await req.json().catch(() => ({}));
  const templateId = String(b?.templateId ?? "").trim();
  const fields = (b?.fields && typeof b.fields === "object") ? b.fields as Record<string, string> : {};
  if (!templateId) return NextResponse.json({ error: "Modèle manquant." }, { status: 400 });

  // Pour l'instant on ne remplit que des champs texte ; les champs image
  // (photo du bien) seront gérés via l'upload d'asset dans une 2ᵉ étape.
  const data: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(fields)) {
    if (typeof value === "string" && value.trim()) data[name] = { type: "text", text: value.slice(0, 2000) };
  }

  const res = await generateVisual(session.user.id, templateId, data);
  if ("error" in res) {
    const msg = res.error === "not_connected" ? "Connectez d'abord Canva." : "La génération du visuel a échoué. Réessayez.";
    return NextResponse.json({ error: msg, code: res.error }, { status: res.error === "not_connected" ? 401 : 502 });
  }
  return NextResponse.json(res);
}
