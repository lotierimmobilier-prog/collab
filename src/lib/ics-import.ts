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
