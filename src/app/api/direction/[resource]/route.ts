import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isDirection, RESOURCES, ResourceConfig } from "@/lib/direction";

// Délégués Prisma par ressource (typés souplement pour un CRUD générique).
interface Delegate {
  findMany(args: unknown): Promise<unknown[]>;
  create(args: unknown): Promise<unknown>;
  update(args: unknown): Promise<unknown>;
  delete(args: unknown): Promise<unknown>;
}
const DELEGATES: Record<string, Delegate> = {
  vehicles:  prisma.vehicle as unknown as Delegate,
  premises:  prisma.premise as unknown as Delegate,
  procards:  prisma.proCard as unknown as Delegate,
  insurance: prisma.insurancePolicy as unknown as Delegate,
};

// Construit l'objet de données à partir du corps, selon la config de ressource.
function buildData(body: Record<string, unknown>, cfg: ResourceConfig) {
  const data: Record<string, unknown> = {};
  for (const f of cfg.strings) if (f in body) data[f] = (body[f] == null || body[f] === "") ? null : String(body[f]);
  for (const f of cfg.dates)   if (f in body) data[f] = body[f] ? new Date(String(body[f])) : null;
  for (const f of cfg.numbers) if (f in body) data[f] = (body[f] === "" || body[f] == null) ? null : Number(body[f]);
  return data;
}

async function guard(resource: string) {
  const session = await auth();
  if (!session?.user) return { error: NextResponse.json({ error: "Non authentifié" }, { status: 401 }) };
  if (!isDirection(session.user.roleId)) return { error: NextResponse.json({ error: "Réservé à la direction" }, { status: 403 }) };
  const cfg = RESOURCES[resource];
  const delegate = DELEGATES[resource];
  if (!cfg || !delegate) return { error: NextResponse.json({ error: "Ressource inconnue" }, { status: 404 }) };
  return { session, cfg, delegate };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params;
  const g = await guard(resource);
  if (g.error) return g.error;
  const items = await g.delegate.findMany({ orderBy: { createdAt: "desc" } });
  return NextResponse.json({ items });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params;
  const g = await guard(resource);
  if (g.error) return g.error;
  const body = await req.json().catch(() => ({}));
  if (!body[g.cfg.required]?.toString().trim())
    return NextResponse.json({ error: `Champ « ${g.cfg.required} » requis` }, { status: 400 });
  const data = buildData(body, g.cfg);
  data.createdById = g.session!.user!.id;
  const item = await g.delegate.create({ data });
  return NextResponse.json({ item }, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params;
  const g = await guard(resource);
  if (g.error) return g.error;
  const body = await req.json().catch(() => ({}));
  const id = body.id;
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  const data = buildData(body, g.cfg);
  const item = await g.delegate.update({ where: { id }, data });
  return NextResponse.json({ item });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ resource: string }> }) {
  const { resource } = await params;
  const g = await guard(resource);
  if (g.error) return g.error;
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  await g.delegate.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
