import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  CONTACT_CATEGORIES_KEY, DEFAULT_CONTACT_CATEGORIES, mergeCategories,
  slugifyCategory, ContactCategory,
} from "@/lib/contactCategories";

async function loadCustom(): Promise<ContactCategory[]> {
  const row = await prisma.setting.findUnique({ where: { key: CONTACT_CATEGORIES_KEY } });
  if (!row) return [];
  try { const arr = JSON.parse(row.value); return Array.isArray(arr) ? arr : []; }
  catch { return []; }
}

async function saveCustom(list: ContactCategory[]) {
  await prisma.setting.upsert({
    where: { key: CONTACT_CATEGORIES_KEY },
    update: { value: JSON.stringify(list) },
    create: { key: CONTACT_CATEGORIES_KEY, value: JSON.stringify(list) },
  });
}

/** GET — catégories (défaut + personnalisées), pour tous les utilisateurs. */
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  const categories = mergeCategories(await loadCustom());
  return NextResponse.json({ categories });
}

/** POST — ajoute une catégorie (admin uniquement). { label, color? } */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.roleId !== "admin")
    return NextResponse.json({ error: "Réservé à l'administrateur" }, { status: 403 });

  const { label, color } = await req.json().catch(() => ({}));
  if (!label?.trim()) return NextResponse.json({ error: "Libellé requis" }, { status: 400 });

  const id = slugifyCategory(label);
  if (!id) return NextResponse.json({ error: "Libellé invalide" }, { status: 400 });
  if (DEFAULT_CONTACT_CATEGORIES.some(c => c.id === id))
    return NextResponse.json({ error: "Cette catégorie existe déjà" }, { status: 409 });

  const custom = await loadCustom();
  if (custom.some(c => c.id === id))
    return NextResponse.json({ error: "Cette catégorie existe déjà" }, { status: 409 });

  custom.push({ id, label: label.trim(), color: color || "#6B7280", custom: true });
  await saveCustom(custom);
  return NextResponse.json({ categories: mergeCategories(custom) }, { status: 201 });
}

/** DELETE — supprime une catégorie personnalisée (admin). ?id=  */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.roleId !== "admin")
    return NextResponse.json({ error: "Réservé à l'administrateur" }, { status: 403 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id requis" }, { status: 400 });
  if (DEFAULT_CONTACT_CATEGORIES.some(c => c.id === id))
    return NextResponse.json({ error: "Catégorie par défaut non supprimable" }, { status: 400 });

  const custom = (await loadCustom()).filter(c => c.id !== id);
  await saveCustom(custom);
  return NextResponse.json({ categories: mergeCategories(custom) });
}
