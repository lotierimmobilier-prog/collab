import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { listResources, addResource, MAX_RESOURCE_BYTES } from "@/lib/formation-resources";

// GET — liste des supports d'une compétence (tout utilisateur connecté).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const { id } = await params;
  return NextResponse.json({ resources: await listResources(id) });
}

// POST — ajout d'un support (admin). body: { title, url } ou { title, fileName, mime, data(base64) }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  if (session.user.roleId !== "admin") return NextResponse.json({ error: "Réservé à l'administration" }, { status: 403 });
  const { id } = await params;

  const b = await req.json().catch(() => ({}));
  const title = typeof b?.title === "string" ? b.title.trim() : "";
  const url = typeof b?.url === "string" ? b.url.trim() : "";
  const data = typeof b?.data === "string" ? b.data : "";
  if (!title) return NextResponse.json({ error: "Titre requis." }, { status: 400 });
  if (!url && !data) return NextResponse.json({ error: "Indiquez un lien ou un fichier." }, { status: 400 });
  if (url && !/^https?:\/\//i.test(url)) return NextResponse.json({ error: "Le lien doit commencer par http(s)://" }, { status: 400 });

  let size = 0;
  if (data) {
    size = Math.ceil((data.length * 3) / 4);
    if (size > MAX_RESOURCE_BYTES) return NextResponse.json({ error: "Fichier trop volumineux (max 15 Mo)." }, { status: 413 });
  }
  const { id: rid } = await addResource(id, {
    title,
    url: url || null,
    fileName: data ? (typeof b?.fileName === "string" ? b.fileName : "support") : null,
    mime: data ? (typeof b?.mime === "string" ? b.mime : "application/octet-stream") : null,
    size: data ? size : null,
    dataB64: data || null,
  });
  return NextResponse.json({ ok: true, id: rid }, { status: 201 });
}
