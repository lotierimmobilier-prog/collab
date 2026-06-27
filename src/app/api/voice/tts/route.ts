import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

// POST /api/voice/tts — synthèse vocale d'un texte via ElevenLabs.
//   body: { text }  → renvoie un flux audio/mpeg (mp3).
// La clé ELEVENLABS_API_KEY reste côté serveur (jamais exposée au client).
// Voix configurable via ELEVENLABS_VOICE_ID (défaut : voix multilingue FR).
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return NextResponse.json({ error: "Synthèse vocale non configurée (ELEVENLABS_API_KEY)." }, { status: 503 });

  const body = await req.json().catch(() => ({}));
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "Texte vide." }, { status: 400 });
  // Garde-fou : on borne la longueur (coût + latence).
  const safeText = text.slice(0, 2500);

  const voiceId = process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL"; // Sarah (multilingue)
  const modelId = process.env.ELEVENLABS_MODEL_ID || "eleven_multilingual_v2";

  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
      body: JSON.stringify({
        text: safeText,
        model_id: modelId,
        voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.0, use_speaker_boost: true },
      }),
    });
    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      return NextResponse.json({ error: `ElevenLabs ${r.status}`, detail: detail.slice(0, 300) }, { status: 502 });
    }
    const audio = await r.arrayBuffer();
    return new NextResponse(audio, {
      status: 200,
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
