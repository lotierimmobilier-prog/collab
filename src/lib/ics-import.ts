// Lecture de l'export ICS « Locataires » (.xls / .xlsx / .csv) et conversion
// en enregistrements de correspondance (bail ↔ locataire ↔ lot ↔ mandat).
// Le mapping se fait par NOM de colonne, donc robuste à un réordonnancement.
import * as XLSX from "xlsx";

export interface IcsTenantRecord {
  idBail: string;
  idLot: string | null;
  idMandat: string | null;
  portefeuille: string | null;
  civiliteLoc: string | null;
  nomLocataire: string | null;
  prenomLocataire: string | null;
  email: string | null;
  mobile: string | null;
  telephone: string | null;
  categorieBail: string | null;
  typeBail: string | null;
  dateEffet: string | null;
  loyer: string | null;
  nomImmeuble: string | null;
  adresseImmeuble: string | null;
  civiliteProprio: string | null;
  nomProprietaire: string | null;
  prenomProprietaire: string | null;
}

const clean = (v: unknown): string => String(v ?? "").trim();
const orNull = (s: string): string | null => (s === "" ? null : s);

/** Parse un buffer d'export ICS et renvoie les enregistrements valides (idBail présent). */
export function parseIcsTenantsExport(buf: Buffer): { records: IcsTenantRecord[]; skipped: number; total: number } {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "", raw: false });

  const records: IcsTenantRecord[] = [];
  let skipped = 0;

  for (const r of rows) {
    const g = (k: string) => clean(r[k]);
    const idBail = g("idBail");
    if (!idBail) { skipped++; continue; }
    records.push({
      idBail,
      idLot: orNull(g("idLot")),
      idMandat: orNull(g("idMandat")),
      portefeuille: orNull(g("portefeuille")),
      civiliteLoc: orNull(g("civilite")),
      nomLocataire: orNull(g("Nom Locataire")),
      prenomLocataire: orNull(g("Prenom Locataire")),
      email: orNull(g("email").split(";")[0].trim()),
      mobile: orNull(g("mobile").split(";")[0].trim()),
      telephone: orNull(g("telephone").split(";")[0].trim()),
      categorieBail: orNull(g("categorieBail")),
      typeBail: orNull(g("typeBail")),
      dateEffet: orNull(g("dateEffet")),
      loyer: orNull(g("Loyer")),
      nomImmeuble: orNull(g("nomImmeuble")),
      adresseImmeuble: orNull(g("Adresse immeuble")),
      civiliteProprio: orNull(g("Civilite Propritaire")),
      nomProprietaire: orNull(g("Nom Proprietaire")),
      prenomProprietaire: orNull(g("Prenom Proprietaire")),
    });
  }

  return { records, skipped, total: rows.length };
}

export interface IcsOwnerRecord {
  idMandat: string | null;
  civilite: string | null;
  nom: string | null;
  prenom: string | null;
  email: string | null;
  phone: string | null;
  adresse: string | null;
}

/**
 * Parse l'export ICS « Propriétaires » (rapport : titre puis en-têtes plus bas).
 * Renvoie un enregistrement par propriétaire (dédupliqué : un propriétaire peut
 * avoir plusieurs mandats).
 */
export function parseIcsOwnersExport(buf: Buffer): { records: IcsOwnerRecord[]; total: number } {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", raw: false });

  const hi = rows.findIndex(r => Array.isArray(r) && r.includes("Nom") && r.includes("Email"));
  if (hi < 0) return { records: [], total: 0 };
  const header = (rows[hi] as unknown[]).map(h => String(h ?? "").trim());
  const col = (name: string) => header.indexOf(name);
  const ci = { civ: col("Civilité"), nom: col("Nom"), prenom: col("Prénom"), tel: col("Téléphone"), mob: col("Mobile"), email: col("Email"), idm: col("Id Mandat"),
    nr: col("Domiciliation N° Rue"), rue: col("Domiciliation Nom Rue"), cp: col("Domiciliation Code Postal"), ville: col("Domiciliation Ville") };

  const at = (r: unknown[], i: number) => (i >= 0 ? String(r[i] ?? "").trim() : "");
  const byKey = new Map<string, IcsOwnerRecord>();
  let total = 0;

  for (const raw of rows.slice(hi + 1)) {
    if (!Array.isArray(raw)) continue;
    const nom = at(raw, ci.nom);
    if (!nom) continue;
    total++;
    const email = at(raw, ci.email).split(";")[0].trim();
    const prenom = at(raw, ci.prenom);
    const key = `${nom.toLowerCase()}|${email.toLowerCase()}`;
    if (byKey.has(key)) continue; // un seul contact par propriétaire (1er mandat conservé)
    const adresse = [at(raw, ci.nr), at(raw, ci.rue), at(raw, ci.cp), at(raw, ci.ville)].filter(Boolean).join(" ").trim();
    byKey.set(key, {
      idMandat: at(raw, ci.idm).replace(/\.0$/, "") || null,
      civilite: at(raw, ci.civ) || null,
      nom, prenom: prenom || null,
      email: email || null,
      phone: (at(raw, ci.mob) || at(raw, ci.tel)) || null,
      adresse: adresse || null,
    });
  }

  return { records: [...byKey.values()], total };
}
