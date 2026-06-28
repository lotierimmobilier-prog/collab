import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { listBrandTemplates, getTemplateDataset } from "@/lib/canva";

// GET /api/canva/templates            — liste des modèles autofill
// GET /api/canva/templates?id=<tid>   — champs (dataset) d'un modèle
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (id) {
    const fields = await getTemplateDataset(session.user.id, id);
    return NextResponse.json({ fields });
  }
  const templates = await listBrandTemplates(session.user.id);
  return NextResponse.json({ templates });
}
