import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// POST /api/formation/questions — créer une question QCM (admin).
//   body: { competenceId, prompt, choices:string[], correctIndex, explanation?, order? }
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (session.user.roleId !== "admin") return NextResponse.json({ error: "Réservé à l'administration" }, { status: 403 });

  const body = await req.json();
  const competenceId = body?.competenceId;
  const prompt = (body?.prompt ?? "").trim();
  const choices = Array.isArray(body?.choices) ? body.choices.map((c: unknown) => String(c).trim()).filter(Boolean) : [];
  if (!competenceId || !prompt) return NextResponse.json({ error: "competenceId et prompt obligatoires" }, { status: 400 });
  if (choices.length < 2) return NextResponse.json({ error: "Au moins deux réponses sont nécessaires" }, { status: 400 });

  let correctIndex = Number(body?.correctIndex);
  if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= choices.length) correctIndex = 0;

  try {
    const q = await prisma.trainingQuestion.create({
      data: {
        competenceId, prompt, choices, correctIndex,
        explanation: body?.explanation?.trim() || null,
        order: Number.isFinite(body?.order) ? Number(body.order) : 0,
      },
    });
    return NextResponse.json(q);
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
