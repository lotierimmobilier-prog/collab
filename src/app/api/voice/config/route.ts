import { NextResponse } from "next/server";
import { auth } from "@/auth";

// GET /api/voice/config — indique si la synthèse vocale (ElevenLabs) est
// disponible côté serveur. La dictée (reconnaissance vocale) est gérée par le
// navigateur et ne dépend pas de cette config.
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  return NextResponse.json({ ttsEnabled: !!process.env.ELEVENLABS_API_KEY });
}
