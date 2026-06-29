import { prisma } from "@/lib/prisma";

// Négociateurs exclus du classement / podium (l'agence elle-même, les non
// affectés, ou des comptes non commerciaux). Surchargeable via le réglage
// « protexa_exclude » (liste séparée par des virgules).
const DEFAULT_EXCLUDE = ["LOTIER IMMOBILIER", "NON AFFECTE", "Aubin MARCHI"];

export function normName(s: string): string {
  return (s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export async function excludedSet(): Promise<Set<string>> {
  const s = await prisma.setting.findUnique({ where: { key: "protexa_exclude" } }).catch(() => null);
  const list = s?.value ? s.value.split(",") : DEFAULT_EXCLUDE;
  return new Set(list.map(normName).filter(Boolean));
}
